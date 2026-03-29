#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# SUMMA SOCIAL — DEPLOY VERIFICAT
# Script determinista i bloquejant per desplegar a produccio.
# Execucio: bash scripts/deploy.sh [branca]  (o npm run deploy -- [branca])
# ============================================================

DEPLOY_LOG="docs/DEPLOY-LOG.md"
INCIDENT_LOG="docs/DEPLOY-INCIDENTS.md"
ROLLBACK_PLAN_FILE="docs/DEPLOY-ROLLBACK-LATEST.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/change-profile.sh"

# Globals (set per funcions)
CHANGED_FILES=""
CHANGED_COUNT=0
RISK_LEVEL="BAIX"
IS_FISCAL=false
FISCAL_TRIGGER_FILES=""
MAIN_SHA=""
PROD_SHA=""
DEPLOY_RESULT="OK"
HUMAN_QUESTION_REASON=""
BUSINESS_IMPACT=""
DECISION_TAKEN="NONE"
BACKUP_RESULT="NO_REQUIRED"
BACKUP_EXPORT_PATH=""
DEPLOY_BLOCK_REASON=""
CURRENT_PHASE="Inicialitzacio"
INCIDENT_RECORDED=false
DEPLOY_SUCCESS=0
DEPLOY_CONTENT_SHA=""
DEPLOY_PROD_BEFORE_SHA=""
MAIN_REMOTE_SYNC_STATUS="NO CAL"
POSTDEPLOY_REMOTE_SHA_STATUS="NO CAL"
POSTDEPLOY_SMOKE_STATUS="NO CAL"
POSTDEPLOY_PUBLIC_CONTENT_STATUS="NO CAL"
POSTDEPLOY_3MIN_STATUS="NO CAL"
POSTDEPLOY_ORACLE_STATUS="NO CAL"
POSTDEPLOY_URLS_READY=false
RESOLVED_DEPLOY_BASE_URL=""
RESOLVED_SMOKE_PUBLIC_URL=""
RESOLVED_SMOKE_DASHBOARD_URL=""
RESOLVED_CHECK_LOGIN_URL=""
RESOLVED_CHECK_CORE_URL=""
RESOLVED_CHECK_REPORT_URL=""
GUIDED_ALERT_EMITTED=false
GUIDED_ALERT_RECOMMENDATION=""
CHANGE_PROFILE="STANDARD"
CHANGE_SCOPE="edge"
FAST_PUBLIC_SCOPE=false
TOUCHES_CORE_INDIRECTLY=false
DEPLOY_SCOPE_MODE="ESTRICTE"
DEPLOY_TARGET_BRANCH="${DEPLOY_TARGET_BRANCH:-${1:-main}}"
DEPLOY_TARGET_BRANCH_SAFE="${DEPLOY_TARGET_BRANCH//\//-}"

append_incident_log() {
  if [ "$INCIDENT_RECORDED" = true ]; then
    return
  fi

  local log_path="$PROJECT_DIR/$INCIDENT_LOG"
  local date
  date=$(TZ="Europe/Madrid" date '+%Y-%m-%d %H:%M')
  local source_sha_short prod_sha_short
  source_sha_short=$(git rev-parse --short "$DEPLOY_TARGET_BRANCH" 2>/dev/null || echo "-")
  prod_sha_short=$(git rev-parse --short prod 2>/dev/null || echo "-")
  local reason
  reason=${DEPLOY_BLOCK_REASON:-"Bloqueig de seguretat a la fase: $CURRENT_PHASE"}

  if [ ! -f "$log_path" ]; then
    mkdir -p "$(dirname "$log_path")"
    cat > "$log_path" << 'HEADER'
# Deploy Incidents — Summa Social

Registre curt d'incidències de deploy bloquejat o incomplet.

| Data | Fase | Risc | Origen | prod | Resultat | Què ha fallat | Com s'ha resolt |
|------|------|------|------|------|----------|---------------|------------------|
HEADER
  fi

  echo "| $date | $CURRENT_PHASE | $RISK_LEVEL | $source_sha_short | $prod_sha_short | $DEPLOY_RESULT | $reason | Pendent |" >> "$log_path"
  INCIDENT_RECORDED=true
}

cleanup_deploy_docs_if_incomplete() {
  if [ "$DEPLOY_SUCCESS" -eq 1 ]; then
    return
  fi

  git restore --staged --worktree -- "$DEPLOY_LOG" "$ROLLBACK_PLAN_FILE" 2>/dev/null || true
}

on_script_exit() {
  local exit_code="$1"
  cleanup_deploy_docs_if_incomplete

  if [ "$exit_code" -ne 0 ]; then
    if [ -z "$DEPLOY_BLOCK_REASON" ]; then
      DEPLOY_BLOCK_REASON="Comprovacio no superada a la fase: $CURRENT_PHASE"
    fi
    if [ -z "$DEPLOY_RESULT" ] || [ "$DEPLOY_RESULT" = "OK" ]; then
      DEPLOY_RESULT="BLOCKED_SAFE"
    fi
    append_incident_log
  fi
}

trap 'on_script_exit $?' EXIT

normalize_url() {
  local url="$1"
  if [ -z "$url" ]; then
    printf '%s' ""
    return
  fi
  printf '%s' "$url" | sed 's#/*$##'
}

extract_base_url_from_full_url() {
  local full_url="$1"
  if [ -z "$full_url" ]; then
    printf '%s' ""
    return
  fi
  printf '%s' "$full_url" | sed -E 's#(https?://[^/]+).*#\1#'
}

read_base_url_from_firebase_json() {
  local config_path="$PROJECT_DIR/firebase.json"
  if [ ! -f "$config_path" ]; then
    printf '%s' ""
    return
  fi

  if ! command -v node >/dev/null 2>&1; then
    printf '%s' ""
    return
  fi

  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    if (!fs.existsSync(path)) process.exit(0);
    try {
      const json = JSON.parse(fs.readFileSync(path, "utf8"));
      const hosting = json && json.hosting;
      const redirects = hosting && Array.isArray(hosting.redirects) ? hosting.redirects : [];
      const rootRedirect = redirects.find(
        (r) => r && r.source === "/" && typeof r.destination === "string" && /^https?:\/\//.test(r.destination)
      );
      if (rootRedirect) process.stdout.write(rootRedirect.destination);
    } catch (_) {}
  ' "$config_path" 2>/dev/null || true
}

read_auth_domain_from_apphosting() {
  local cfg="$PROJECT_DIR/apphosting.yaml"
  if [ ! -f "$cfg" ]; then
    printf '%s' ""
    return
  fi

  awk '
    $0 ~ /variable:[[:space:]]*NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/ { seen=1; next }
    seen==1 && $0 ~ /value:/ {
      gsub(/"/, "", $2)
      print $2
      exit
    }
  ' "$cfg"
}

resolve_postdeploy_urls() {
  if [ "$POSTDEPLOY_URLS_READY" = true ]; then
    return
  fi

  local base_url=""

  if [ -n "${DEPLOY_BASE_URL:-}" ]; then
    base_url=$(normalize_url "$DEPLOY_BASE_URL")
  fi

  if [ -z "$base_url" ] && [ -n "${DEPLOY_SMOKE_PUBLIC_URL:-}" ]; then
    base_url=$(normalize_url "$(extract_base_url_from_full_url "$DEPLOY_SMOKE_PUBLIC_URL")")
  fi

  if [ -z "$base_url" ]; then
    base_url=$(normalize_url "$(read_base_url_from_firebase_json)")
  fi

  if [ -z "$base_url" ] && [ -n "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}" ]; then
    base_url=$(normalize_url "https://${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}")
  fi

  if [ -z "$base_url" ]; then
    local auth_domain
    auth_domain=$(read_auth_domain_from_apphosting)
    if [ -n "$auth_domain" ]; then
      base_url=$(normalize_url "https://${auth_domain}")
    fi
  fi

  RESOLVED_DEPLOY_BASE_URL="$base_url"

  RESOLVED_SMOKE_PUBLIC_URL="${DEPLOY_SMOKE_PUBLIC_URL:-}"
  RESOLVED_SMOKE_DASHBOARD_URL="${DEPLOY_SMOKE_DASHBOARD_URL:-}"

  if [ -z "$RESOLVED_SMOKE_PUBLIC_URL" ] && [ -n "$RESOLVED_DEPLOY_BASE_URL" ]; then
    RESOLVED_SMOKE_PUBLIC_URL="${RESOLVED_DEPLOY_BASE_URL}/public/ca"
  fi

  if [ -z "$RESOLVED_SMOKE_DASHBOARD_URL" ] && [ -n "$RESOLVED_DEPLOY_BASE_URL" ]; then
    RESOLVED_SMOKE_DASHBOARD_URL="${RESOLVED_DEPLOY_BASE_URL}/login"
  fi

  RESOLVED_CHECK_LOGIN_URL="${DEPLOY_CHECK_LOGIN_URL:-$RESOLVED_SMOKE_DASHBOARD_URL}"
  RESOLVED_CHECK_CORE_URL="${DEPLOY_CHECK_CORE_URL:-}"
  RESOLVED_CHECK_REPORT_URL="${DEPLOY_CHECK_REPORT_URL:-}"

  if [ -z "$RESOLVED_CHECK_CORE_URL" ] && [ -n "$RESOLVED_DEPLOY_BASE_URL" ]; then
    RESOLVED_CHECK_CORE_URL="${RESOLVED_DEPLOY_BASE_URL}/redirect-to-org"
  elif [ -z "$RESOLVED_CHECK_CORE_URL" ]; then
    RESOLVED_CHECK_CORE_URL="$RESOLVED_SMOKE_DASHBOARD_URL"
  fi

  if [ -z "$RESOLVED_CHECK_REPORT_URL" ] && [ -n "$RESOLVED_DEPLOY_BASE_URL" ]; then
    RESOLVED_CHECK_REPORT_URL="${RESOLVED_DEPLOY_BASE_URL}/public/ca/funcionalitats"
  elif [ -z "$RESOLVED_CHECK_REPORT_URL" ]; then
    RESOLVED_CHECK_REPORT_URL="$RESOLVED_SMOKE_PUBLIC_URL"
  fi

  POSTDEPLOY_URLS_READY=true
}

wait_for_text_marker() {
  local label="$1"
  local url="$2"
  local marker="$3"
  local attempts="${4:-6}"
  local delay_seconds="${5:-10}"
  local i
  local body

  for i in $(seq 1 "$attempts"); do
    if body=$(curl -fsSL --max-time 20 "$url" 2>/dev/null) && printf '%s' "$body" | grep -Fq "$marker"; then
      echo "  OK: $label"
      return 0
    fi
    sleep "$delay_seconds"
  done

  echo "  PENDENT: $label"
  return 1
}

# Patrons area fiscal (gate bloquejant)
FISCAL_PATTERNS=(
  "src/lib/remittances/"
  "src/lib/sepa/"
  "src/lib/fiscal/"
  "src/app/api/remittances/"
  "src/components/donor-"
  "src/components/return-"
  "src/components/remittance-"
  "src/components/transaction-"
  "/movimientos/"
)

# Patrons RISC ALT (superset fiscal)
HIGH_RISK_PATTERNS=(
  "src/app/api/"
  "src/lib/fiscal/"
  "src/lib/remittances/"
  "src/lib/sepa/"
  "project-module"
  "fx"
  "exchange"
  "budget"
  "firestore.rules"
  "storage.rules"
)

# Patrons RISC BAIX (nomes docs/i18n/static)
LOW_RISK_PATTERNS=(
  "^docs/"
  "^src/i18n/"
  "^public/"
  "\.md$"
  "\.txt$"
)

# ============================================================
# PAS 1 — Preflight git (BLOQUEJANT)
# ============================================================
preflight_git_checks() {
  CURRENT_PHASE="Preflight git"
  local gate_message=""
  echo ""
  echo "[1/9] Comprovacions previes de git..."

  bash "$SCRIPT_DIR/worktree.sh" gc --quiet >/dev/null 2>&1 || true
  gate_message="$(DEPLOY_TARGET_BRANCH="$DEPLOY_TARGET_BRANCH" bash "$SCRIPT_DIR/status.sh" gate publica 2>&1 || true)"
  if [ -n "$gate_message" ]; then
    DEPLOY_BLOCK_REASON="$gate_message"
    echo "ERROR: $DEPLOY_BLOCK_REASON"
    exit 1
  fi

  # 1a. Branca actual ha de ser la branca origen del deploy
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  if [ "$branch" != "$DEPLOY_TARGET_BRANCH" ]; then
    DEPLOY_BLOCK_REASON="El deploy nomes es pot fer des de la branca origen indicada."
    echo "ERROR: Has d'estar a la branca '$DEPLOY_TARGET_BRANCH' per desplegar."
    echo "  Branca actual: $branch"
    echo "  Executa: git checkout $DEPLOY_TARGET_BRANCH"
    exit 1
  fi

  # 1b. Working tree net
  if [ -n "$(git status --porcelain)" ]; then
    DEPLOY_BLOCK_REASON="Hi ha canvis pendents sense tancar abans de publicar."
    echo "ERROR: Hi ha canvis sense commitejar o fitxers sense seguiment."
    echo "  Fes commit o descarta els canvis abans de desplegar."
    git status --short
    exit 1
  fi

  # 1c. Fetch
  echo "  Descarregant canvis del servidor..."
  git fetch origin

  # 1d. Pull ff-only a la branca origen
  echo "  Actualitzant $DEPLOY_TARGET_BRANCH..."
  if ! git merge --ff-only "refs/remotes/origin/$DEPLOY_TARGET_BRANCH" >/dev/null 2>&1; then
    DEPLOY_BLOCK_REASON="La branca origen no esta sincronitzada amb remot."
    echo "ERROR: La branca '$DEPLOY_TARGET_BRANCH' ha divergit del remot."
    echo "  Cal resoldre manualment abans de desplegar."
    exit 1
  fi

  # 1e. Pull ff-only a prod
  echo "  Actualitzant prod..."
  git checkout prod --quiet
  if ! git merge --ff-only refs/remotes/origin/prod >/dev/null 2>&1; then
    DEPLOY_BLOCK_REASON="Prod no esta sincronitzada amb remot."
    echo "ERROR: La branca 'prod' ha divergit del remot."
    echo "  Cal resoldre manualment abans de desplegar."
    git checkout "$DEPLOY_TARGET_BRANCH" --quiet
    exit 1
  fi

  # Tornar a la branca origen
  git checkout "$DEPLOY_TARGET_BRANCH" --quiet

  MAIN_SHA=$(git rev-parse --short HEAD)
  PROD_SHA=$(git rev-parse --short prod)

  if ! git merge-base --is-ancestor refs/remotes/origin/prod "refs/heads/$DEPLOY_TARGET_BRANCH" >/dev/null 2>&1; then
    DEPLOY_BLOCK_REASON="Prod conté commits fora de la branca origen."
    echo "ERROR: prod conté commits fora de '$DEPLOY_TARGET_BRANCH'."
    echo "  El model branca origen -> prod ha quedat desalineat i cal resoldre-ho abans de publicar."
    exit 1
  fi

  echo "  Comprovacions OK."
  echo ""
}

# ============================================================
# PAS 2 — Detectar canvis (BLOQUEJANT si 0)
# ============================================================
detect_changed_files() {
  CURRENT_PHASE="Detectar canvis"
  echo "[2/9] Detectant fitxers canviats ($DEPLOY_TARGET_BRANCH vs prod)..."

  CHANGED_FILES=$(git diff --name-only "prod..$DEPLOY_TARGET_BRANCH" --diff-filter=ACMRT)

  if [ -z "$CHANGED_FILES" ]; then
    echo "  Res a desplegar ($DEPLOY_TARGET_BRANCH == prod)."
    exit 0
  fi

  CHANGED_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
  echo "  $CHANGED_COUNT fitxers canviats:"
  echo ""
  while IFS= read -r f; do
    echo "    $f"
  done <<< "$(echo "$CHANGED_FILES" | head -20)"
  if [ "$CHANGED_COUNT" -gt 20 ]; then
    echo "    ... i $((CHANGED_COUNT - 20)) mes."
  fi
  echo ""
}

# ============================================================
# PAS 3 — Classificar risc (INFORMATIU)
# ============================================================
classify_risk() {
  CURRENT_PHASE="Classificar risc"
  echo "[3/9] Classificant nivell de risc..."
  local scope_eval=""

  # Detectar area fiscal i guardar fitxers que la disparen
  local fiscal_matches=""
  for pattern in "${FISCAL_PATTERNS[@]}"; do
    local hits
    hits=$(echo "$CHANGED_FILES" | grep "$pattern" || true)
    if [ -n "$hits" ]; then
      if [ -n "$fiscal_matches" ]; then
        fiscal_matches="$fiscal_matches"$'\n'"$hits"
      else
        fiscal_matches="$hits"
      fi
    fi
  done
  if [ -n "$fiscal_matches" ]; then
    IS_FISCAL=true
    FISCAL_TRIGGER_FILES=$(echo "$fiscal_matches" | sort -u)
  fi

  # Detectar HIGH RISK
  local is_high=false
  for pattern in "${HIGH_RISK_PATTERNS[@]}"; do
    if echo "$CHANGED_FILES" | grep -q "$pattern"; then
      is_high=true
      break
    fi
  done

  if [ "$is_high" = true ]; then
    RISK_LEVEL="ALT"
  else
    # Comprovar si TOTS els fitxers son BAIX
    local all_low=true
    while IFS= read -r file; do
      local matched_low=false
      for pattern in "${LOW_RISK_PATTERNS[@]}"; do
        if echo "$file" | grep -qE "$pattern"; then
          matched_low=true
          break
        fi
      done
      if [ "$matched_low" = false ]; then
        all_low=false
        break
      fi
    done <<< "$CHANGED_FILES"

    if [ "$all_low" = true ]; then
      RISK_LEVEL="BAIX"
    else
      RISK_LEVEL="MITJA"
    fi
  fi

  CHANGE_PROFILE="$(summa_change_profile "$CHANGED_FILES")"
  scope_eval="$(summa_scope_eval "$CHANGED_FILES")"
  eval "$scope_eval"
  CHANGE_SCOPE="$SCOPE"
  TOUCHES_CORE_INDIRECTLY="$TOUCHES_CORE_INDIRECTLY"
  DEPLOY_SCOPE_MODE="$DEPLOY_MODE"
  if [ "$CHANGE_PROFILE" = "FAST_PUBLIC" ] && [ "$IS_FISCAL" = false ]; then
    FAST_PUBLIC_SCOPE=true
  fi

  echo "  Risc detectat: $RISK_LEVEL"
  echo "  Area fiscal: $([ "$IS_FISCAL" = true ] && echo "Si" || echo "No")"
  echo "  Scope detectat: $(printf '%s' "$CHANGE_SCOPE" | tr '[:lower:]' '[:upper:]')"
  echo "  Mode deploy: $DEPLOY_SCOPE_MODE"
  echo "  Perfil deploy: $CHANGE_PROFILE"
  echo ""
}

enforce_scope_guardrail() {
  CURRENT_PHASE="Guardrail scope"
  echo "[3a/9] Validant separacio CORE/EDGE..."

  if [ "$CHANGE_SCOPE" = "edge" ] && [ "$TOUCHES_CORE_INDIRECTLY" = "true" ]; then
    DEPLOY_BLOCK_REASON="EDGE intentant tocar CORE"
    echo "ERROR: EDGE intentant tocar CORE."
    echo "  Guardrail minim activat: data.ts i qualsevol API forcen circuit estricte."
    exit 1
  fi

  echo "  Guardrail scope OK."
  echo ""
}

auto_predeploy_backup() {
  CURRENT_PHASE="Backup curt predeploy"
  echo "[3b/9] Backup curt predeploy..."
  echo ""

  local is_prod_deploy=false
  if [ "${ENV:-}" = "prod" ]; then
    is_prod_deploy=true
  fi

  if [ -z "${FIRESTORE_BACKUP_BUCKET:-}" ] && [ "$is_prod_deploy" = true ]; then
    BACKUP_RESULT="BLOCKED_NO_BUCKET"
    DEPLOY_BLOCK_REASON="FIRESTORE_BACKUP_BUCKET no configurat"
    DEPLOY_RESULT="BLOCKED_SAFE"
    echo "ERROR: FIRESTORE_BACKUP_BUCKET no configurat"
    exit 1
  fi

  if [ "$is_prod_deploy" = false ] && { [ "$RISK_LEVEL" != "ALT" ] || [ "$IS_FISCAL" != true ]; }; then
    BACKUP_RESULT="NO_REQUIRED"
    echo "  No cal backup extra (nomes s'activa amb risc ALT fiscal)."
    echo ""
    return
  fi

  if [ -z "${FIRESTORE_BACKUP_BUCKET:-}" ]; then
    BACKUP_RESULT="SKIPPED_NO_BUCKET"
    echo "  Backup no executat: bucket no configurat (FIRESTORE_BACKUP_BUCKET)."
    echo ""
    return
  fi

  if ! command -v firebase >/dev/null 2>&1; then
    if [ "$is_prod_deploy" = true ]; then
      BACKUP_RESULT="BLOCKED_NO_FIREBASE_CLI"
      DEPLOY_BLOCK_REASON="Firebase CLI no disponible per backup obligatori en prod"
      DEPLOY_RESULT="BLOCKED_SAFE"
      echo "ERROR: Firebase CLI no disponible per executar el backup obligatori de prod"
      exit 1
    fi
    BACKUP_RESULT="SKIPPED_NO_FIREBASE_CLI"
    echo "  Backup no executat: falta Firebase CLI en aquest entorn."
    echo ""
    return
  fi

  local export_suffix
  export_suffix=$(TZ="Europe/Madrid" date '+%Y%m%d-%H%M%S')
  BACKUP_EXPORT_PATH="gs://${FIRESTORE_BACKUP_BUCKET}/summa-social/predeploy/${export_suffix}-${DEPLOY_TARGET_BRANCH_SAFE}-${MAIN_SHA}"

  local backup_cmd=(firebase firestore:export "$BACKUP_EXPORT_PATH")
  if [ -n "${FIREBASE_PROJECT_ID:-}" ]; then
    backup_cmd+=(--project "$FIREBASE_PROJECT_ID")
  fi

  if "${backup_cmd[@]}" >/dev/null 2>&1; then
    BACKUP_RESULT="OK"
    echo "  Backup curt completat correctament."
    echo ""
    return
  fi

  if [ "$is_prod_deploy" = true ]; then
    BACKUP_RESULT="BLOCKED_BACKUP_FAILED"
    DEPLOY_BLOCK_REASON="Backup Firestore obligatori de prod no completat"
    DEPLOY_RESULT="BLOCKED_SAFE"
    echo "ERROR: Backup Firestore obligatori de prod no completat"
    exit 1
  fi

  BACKUP_RESULT="FAILED_NON_BLOCKING"
  echo "  Backup curt no completat. Continuo igualment per no bloquejar un deploy urgent."
  echo ""
}

# ============================================================
# PAS 4 — Verificacio area fiscal (BLOQUEJANT)
# ============================================================

# Heuristica: patrons que indiquen logica de negoci (NO UI-only)
CALC_RE="calculate|compute|total|sum|balance|ledger|reconcil|model182|model347|certificat"
AMOUNT_RE="amount|currency|rate|fx|tax|iva|irpf"
WRITE_RE="\.set\(|\.update\(|\.add\(|\.delete\(|batch|runTransaction|writeBatch"
FIELD_RE="archivedAt|parentTransactionId|donorId|contactId|bankAccountId|categoryId|isRemittance"
PERM_RE="permission|\.rules|getAuth|verifyIdToken|validateUser"
SEPA_RE="sepa|pain001|pain008|remittance|generateXml"

# Globals de classificacio (set per classify_fiscal_impact)
FISCAL_IS_UI_ONLY=true
FISCAL_IMPACT_TYPE=""
FISCAL_AFFECTS_MONEY=""
FISCAL_RECOMMENDATION=""
FISCAL_KEY_DETAILS=""
FISCAL_HAS_CALC=false
FISCAL_HAS_AMOUNT=false
FISCAL_HAS_WRITE=false
FISCAL_HAS_FIELD=false
FISCAL_HAS_PERM=false
FISCAL_HAS_SEPA=false
FISCAL_UNCLASSIFIABLE=false

contains_technical_terms() {
  local text_lower
  text_lower=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  local banned=(
    "git"
    "merge"
    "flag"
    "--no-verify"
    "branca"
    "branch"
    "commit"
    "push"
    "sha"
    "log tecnic"
  )
  local term
  for term in "${banned[@]}"; do
    if printf '%s' "$text_lower" | grep -q -- "$term"; then
      return 0
    fi
  done
  return 1
}

derive_business_impact_message() {
  if [ "$FISCAL_HAS_CALC" = true ] || [ "$FISCAL_HAS_AMOUNT" = true ]; then
    printf '%s' "podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals."
    return
  fi
  if [ "$FISCAL_HAS_SEPA" = true ]; then
    printf '%s' "podria afectar el processament de remeses, i l'entitat podria veure cobraments o assignacions que no toquen."
    return
  fi
  if [ "$FISCAL_HAS_WRITE" = true ] || [ "$FISCAL_HAS_FIELD" = true ]; then
    printf '%s' "podria desalinear dades econòmiques sensibles, i l'entitat podria veure informació inconsistent en moviments o fitxes."
    return
  fi
  if [ "$FISCAL_HAS_PERM" = true ]; then
    printf '%s' "podria canviar qui veu o edita informació sensible, i l'entitat podria tenir accessos no esperats."
    return
  fi
  if echo "$CHANGED_FILES" | grep -q "firestore.rules\|storage.rules"; then
    printf '%s' "podria afectar l'accés a dades sensibles, i l'entitat podria veure restriccions incorrectes o exposició de dades."
    return
  fi
  if echo "$CHANGED_FILES" | grep -q "project-module\|fx\|exchange\|budget"; then
    printf '%s' "podria afectar càlculs econòmics de projectes, i l'entitat podria veure imports o desviacions incorrectes."
    return
  fi
  printf '%s' ""
}

assess_residual_alt_risk() {
  if [ "$RISK_LEVEL" != "ALT" ]; then
    return 1
  fi
  if [ "$FISCAL_RECOMMENDATION" = "red" ] || [ "$FISCAL_UNCLASSIFIABLE" = true ]; then
    return 0
  fi
  if echo "$CHANGED_FILES" | grep -q "firestore.rules\|storage.rules\|project-module\|fx\|exchange\|budget"; then
    return 0
  fi
  return 1
}

handle_business_decision_for_residual_risk() {
  if ! assess_residual_alt_risk; then
    return 0
  fi

  HUMAN_QUESTION_REASON="Risc ALT residual detectat (avís guiat, no bloquejant)."
  BUSINESS_IMPACT=$(derive_business_impact_message)

  if [ -z "$BUSINESS_IMPACT" ]; then
    BUSINESS_IMPACT="podria afectar dades econòmiques o fiscals de l'entitat i convé validar un cas real abans de publicar."
  fi

  local touched_summary
  if [ "$FISCAL_HAS_CALC" = true ] || [ "$FISCAL_HAS_AMOUNT" = true ]; then
    touched_summary="S'han tocat calculs o imports que impacten resultats economics."
  elif [ "$FISCAL_HAS_SEPA" = true ]; then
    touched_summary="S'ha tocat logica de remeses o cobraments."
  elif [ "$FISCAL_HAS_WRITE" = true ] || [ "$FISCAL_HAS_FIELD" = true ]; then
    touched_summary="S'han tocat dades sensibles de moviments o fitxes."
  elif [ "$FISCAL_HAS_PERM" = true ]; then
    touched_summary="S'han tocat permisos sobre dades sensibles."
  elif [ "$FISCAL_UNCLASSIFIABLE" = true ]; then
    touched_summary="S'ha detectat un canvi gran en zona sensible."
  else
    touched_summary="S'ha detectat un canvi en zona de risc alt."
  fi

  local recommendation
  if [ "$FISCAL_RECOMMENDATION" = "red" ] || [ "$FISCAL_UNCLASSIFIABLE" = true ]; then
    recommendation="Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat)."
  else
    recommendation="Recomanacio: publicar amb monitoratge curt post-deploy."
  fi
  GUIDED_ALERT_RECOMMENDATION="$recommendation"
  GUIDED_ALERT_EMITTED=true
  DECISION_TAKEN="AUTO_CONTINUE_GUIDED_WARNING"

  echo "[6b/9] Avis guiat de negoci (risc ALT residual)..."
  echo ""
  echo "  Que s'ha tocat: $touched_summary"
  echo "  Impacte possible per a l'entitat: $BUSINESS_IMPACT"
  echo "  Comprovacions automatiques superades fins ara: verificacio local, CI i oracle fiscal predeploy."
  echo "  $recommendation"
  echo "  Politica actual: continuo amb el deploy i deixo aquest avís registrat."
  echo ""

  # Mode estricte opcional per entorns que vulguin bloqueig manual en risc ALT residual.
  if [ "${DEPLOY_REQUIRE_MANUAL_CONFIRMATION_ON_RESIDUAL_ALT:-0}" = "1" ]; then
    DECISION_TAKEN="AUTO_BLOCKED_STRICT_MODE_RESIDUAL_ALT"
    DEPLOY_RESULT="BLOCKED_SAFE"
    DEPLOY_BLOCK_REASON="Risc ALT residual en mode estricte."
    echo "  Mode estricte activat: deploy bloquejat per risc ALT residual."
    append_deploy_log
    exit 1
  fi
}

classify_fiscal_impact() {
  local has_calc=false has_amount=false has_write=false
  local has_field=false has_perm=false has_sepa=false
  local unclassifiable=false
  FISCAL_IS_UI_ONLY=true
  FISCAL_KEY_DETAILS=""

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    local diff_content changes line_count tags
    diff_content=$(git diff "prod..$DEPLOY_TARGET_BRANCH" -- "$file" 2>/dev/null)
    [ -z "$diff_content" ] && continue

    # Nomes linies canviades (exclou headers de diff)
    changes=$(printf '%s\n' "$diff_content" | grep -E '^[+-]' | grep -vE '^\+\+\+|^---')

    line_count=$(printf '%s\n' "$changes" | wc -l | tr -d ' ')
    if [ "$line_count" -gt 500 ]; then
      unclassifiable=true
      FISCAL_IS_UI_ONLY=false
      FISCAL_KEY_DETAILS="$FISCAL_KEY_DETAILS    - $file (canvi gran, revisio manual)"$'\n'
      continue
    fi

    tags=""
    if printf '%s\n' "$changes" | grep -qEi "$CALC_RE"; then
      has_calc=true; FISCAL_IS_UI_ONLY=false; tags="${tags}calcul "
    fi
    if printf '%s\n' "$changes" | grep -qEi "$AMOUNT_RE"; then
      has_amount=true; FISCAL_IS_UI_ONLY=false; tags="${tags}imports "
    fi
    if printf '%s\n' "$changes" | grep -qEi "$WRITE_RE"; then
      has_write=true; FISCAL_IS_UI_ONLY=false; tags="${tags}escriptura "
    fi
    if printf '%s\n' "$changes" | grep -qEi "$FIELD_RE"; then
      has_field=true; FISCAL_IS_UI_ONLY=false; tags="${tags}camps-critics "
    fi
    if printf '%s\n' "$changes" | grep -qEi "$PERM_RE"; then
      has_perm=true; FISCAL_IS_UI_ONLY=false; tags="${tags}permisos "
    fi
    if printf '%s\n' "$changes" | grep -qEi "$SEPA_RE"; then
      has_sepa=true; FISCAL_IS_UI_ONLY=false; tags="${tags}SEPA "
    fi

    [ -z "$tags" ] && tags="UI"
    FISCAL_KEY_DETAILS="$FISCAL_KEY_DETAILS    - $file ($tags)"$'\n'
  done <<< "$FISCAL_TRIGGER_FILES"

  # Tipus d'impacte
  FISCAL_HAS_CALC=$has_calc
  FISCAL_HAS_AMOUNT=$has_amount
  FISCAL_HAS_WRITE=$has_write
  FISCAL_HAS_FIELD=$has_field
  FISCAL_HAS_PERM=$has_perm
  FISCAL_HAS_SEPA=$has_sepa
  FISCAL_UNCLASSIFIABLE=$unclassifiable

  if [ "$FISCAL_IS_UI_ONLY" = true ]; then
    FISCAL_IMPACT_TYPE="UI"
  else
    local types=""
    if [ "$has_calc" = true ] || [ "$has_amount" = true ]; then
      types="Calcul"
    fi
    if [ "$has_write" = true ] || [ "$has_field" = true ]; then
      types="${types:+$types / }Dades"
    fi
    if [ "$has_perm" = true ]; then
      types="${types:+$types / }Permisos"
    fi
    if [ "$has_sepa" = true ]; then
      types="${types:+$types / }SEPA-Remeses"
    fi
    if [ "$unclassifiable" = true ]; then
      types="${types:+$types / }No classificable"
    fi
    [ -z "$types" ] && types="Indeterminat"
    FISCAL_IMPACT_TYPE="$types"
  fi

  # Pot afectar diners?
  if [ "$FISCAL_IS_UI_ONLY" = true ]; then
    FISCAL_AFFECTS_MONEY="No. Canvi visual/presentacio. No es modifica cap calcul ni saldo."
  elif [ "$has_calc" = true ] || [ "$has_amount" = true ]; then
    FISCAL_AFFECTS_MONEY="Si. Es modifiquen calculs o imports."
  elif [ "$has_sepa" = true ]; then
    FISCAL_AFFECTS_MONEY="Si. Es modifica logica de remeses o SEPA."
  elif [ "$has_write" = true ] || [ "$has_field" = true ]; then
    FISCAL_AFFECTS_MONEY="Possible. Es modifiquen dades o camps critics."
  elif [ "$has_perm" = true ]; then
    FISCAL_AFFECTS_MONEY="No directament. Es modifiquen permisos."
  else
    FISCAL_AFFECTS_MONEY="No classificable. Revisar manualment."
  fi

  # Recomanacio
  if [ "$FISCAL_IS_UI_ONLY" = true ]; then
    FISCAL_RECOMMENDATION="green"
  elif [ "$has_calc" = true ] || [ "$has_sepa" = true ] || [ "$has_amount" = true ] || [ "$unclassifiable" = true ]; then
    FISCAL_RECOMMENDATION="red"
  else
    FISCAL_RECOMMENDATION="yellow"
  fi
}

fiscal_impact_gate() {
  CURRENT_PHASE="Analisi fiscal"
  if [ "$IS_FISCAL" != true ]; then
    return 0
  fi

  echo "[4/9] Analitzant area fiscal..."
  echo ""

  classify_fiscal_impact

  # Resum huma (sempre)
  echo "  ┌─────────────────────────────────────────────┐"
  echo "  │         IMPACTE DEL CANVI (RESUM)           │"
  echo "  └─────────────────────────────────────────────┘"
  echo ""
  echo "  Tipus: $FISCAL_IMPACT_TYPE"
  echo "  Pot afectar diners, saldos o fiscalitat?"
  echo "    $FISCAL_AFFECTS_MONEY"
  if [ "$FISCAL_RECOMMENDATION" = "green" ]; then
    echo "  Recomanacio: 🟢 Desplegar"
  elif [ "$FISCAL_RECOMMENDATION" = "yellow" ]; then
    echo "  Recomanacio: 🟡 Provar abans amb un cas real"
  else
    echo "  Recomanacio: 🔴 Verificar amb docs/QA-FISCAL.md abans de desplegar"
  fi
  echo ""
  echo "  Fitxers clau:"
  printf '%s' "$FISCAL_KEY_DETAILS"
  echo ""

  # Si UI-only → no bloquejar
  if [ "$FISCAL_IS_UI_ONLY" = true ]; then
    echo "  Detectat fitxer en zona sensible, pero canvi UI-only."
    echo "  Continuo sense bloquejar."
    echo ""
    return 0
  fi

  # No es pregunta aquí: el resum de negoci es mostra després com a avís guiat
  # no bloquejant (excepte mode estricte).
  echo ""
}

# ============================================================
# PAS 5 — Verificacions (BLOQUEJANT)
# ============================================================
run_verifications() {
  CURRENT_PHASE="Verificacions"
  local verify_profile="STANDARD"

  if [ "$FAST_PUBLIC_SCOPE" = true ] && [ "$IS_FISCAL" = false ]; then
    verify_profile="FAST_PUBLIC"
  fi

  echo "[5/9] Executant verificacions..."
  echo ""
  echo "  Perfil de verificació: $verify_profile"
  echo ""

  echo "  --- verify-local.sh ---"
  if ! VERIFY_PROFILE="$verify_profile" bash "$SCRIPT_DIR/verify-local.sh"; then
    DEPLOY_BLOCK_REASON="La verificacio local no ha passat."
    echo ""
    echo "ERROR: verify-local.sh ha fallat."
    echo "  Corregeix els errors i torna a executar el deploy."
    exit 1
  fi
  echo ""

  if [ -f "$SCRIPT_DIR/verify-ci.sh" ]; then
    echo "  --- verify-ci.sh ---"
    if ! VERIFY_PROFILE="$verify_profile" bash "$SCRIPT_DIR/verify-ci.sh"; then
      DEPLOY_BLOCK_REASON="La verificacio de CI no ha passat."
      echo ""
      echo "ERROR: verify-ci.sh ha fallat."
      echo "  Corregeix els errors i torna a executar el deploy."
      exit 1
    fi
  else
    echo "  verify-ci.sh: skip (no existeix)"
  fi

  echo ""
  echo "  Totes les verificacions OK."
  echo ""
}

run_fiscal_oracle_predeploy() {
  CURRENT_PHASE="Oracle fiscal predeploy"
  echo "[5b/9] Executant oracle fiscal (bloquejant)..."
  echo ""

  if [ "$FAST_PUBLIC_SCOPE" = true ] && [ "$IS_FISCAL" = false ]; then
    echo "  Oracle fiscal predeploy: NO CAL (scope EDGE rapid)."
    echo ""
    return
  fi

  if ! node --import tsx "$SCRIPT_DIR/fiscal/run-oracle.ts" --stage=predeploy; then
    DEPLOY_BLOCK_REASON="FISCAL_ORACLE_FAIL (predeploy)"
    DEPLOY_RESULT="BLOCKED_SAFE"
    echo ""
    echo "ERROR: FISCAL_ORACLE_FAIL"
    echo "  Revisa el diff de mètriques oracle abans de publicar."
    exit 1
  fi

  echo "  Oracle fiscal predeploy OK."
  echo ""
}

# ============================================================
# PAS 6 — Resum + avís guiat si hi ha risc ALT residual
# ============================================================
display_deploy_summary() {
  CURRENT_PHASE="Resum predeploy"
  echo "[6/9] Resum del deploy..."
  echo ""
  echo "  Branques:"
  echo "    origen ($DEPLOY_TARGET_BRANCH): $MAIN_SHA"
  echo "    prod:                     $PROD_SHA"
  echo ""
  echo "  Risc:     $RISK_LEVEL"
  echo "  Perfil:   $CHANGE_PROFILE"
  echo "  Fiscal:   $([ "$IS_FISCAL" = true ] && echo "Si" || echo "No")"
  echo "  Fitxers:  $CHANGED_COUNT"
  echo "  Backup:   $BACKUP_RESULT"
  echo ""
}

prepare_rollback_plan() {
  CURRENT_PHASE="Preparar rollback"
  echo "[8c/9] Preparant rollback..."
  echo ""

  local date current_prod_sha target_branch_sha
  date=$(TZ="Europe/Madrid" date '+%Y-%m-%d %H:%M')
  current_prod_sha="${DEPLOY_PROD_BEFORE_SHA:-$(git rev-parse --short prod)}"
  target_branch_sha="${DEPLOY_CONTENT_SHA:-$(git rev-parse --short "$DEPLOY_TARGET_BRANCH")}"

  cat > "$PROJECT_DIR/$ROLLBACK_PLAN_FILE" <<EOF
# Rollback Plan (auto) — Summa Social

Generat: $date
Risc: $RISK_LEVEL
Backup curt: $BACKUP_RESULT
SHA prod abans de publicar: $current_prod_sha
SHA branca a publicar ($DEPLOY_TARGET_BRANCH): $target_branch_sha

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
\`\`\`bash
git checkout $DEPLOY_TARGET_BRANCH
git revert $target_branch_sha --no-edit
git push origin $DEPLOY_TARGET_BRANCH
bash scripts/deploy.sh $DEPLOY_TARGET_BRANCH
\`\`\`

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
\`\`\`bash
git checkout prod
git reset --hard $current_prod_sha
git push origin prod --force-with-lease
\`\`\`
EOF

  echo "  Rollback preparat a $ROLLBACK_PLAN_FILE"
  echo ""
}

# ============================================================
# PAS 7 — Merge ritual + push (BLOQUEJANT)
# ============================================================
execute_merge_ritual() {
  CURRENT_PHASE="Merge i push a prod"
  echo "[7/9] Executant merge ritual..."

  # branca origen -> prod
  echo "  $DEPLOY_TARGET_BRANCH -> prod..."
  git checkout prod --quiet
  if ! git merge --no-ff "$DEPLOY_TARGET_BRANCH" -m "chore(deploy): merge $DEPLOY_TARGET_BRANCH -> prod"; then
    DEPLOY_BLOCK_REASON="Hi ha conflicte d'integracio entre la branca origen i prod."
    echo ""
    echo "ERROR: Conflicte de merge a prod."
    git merge --abort || true
    git checkout "$DEPLOY_TARGET_BRANCH" --quiet
    echo "  Resol el conflicte manualment."
    exit 1
  fi
  git push origin prod
  echo "  prod actualitzat i pujat."

  # Tornar a la branca origen
  git checkout "$DEPLOY_TARGET_BRANCH" --quiet
  echo "  Tornat a $DEPLOY_TARGET_BRANCH."
  echo ""
}

# ============================================================
# PAS 8 — Post-deploy check (automatic; sense preguntes tecniques)
# ============================================================
post_deploy_check() {
  CURRENT_PHASE="Post-check automatic"
  local prod_sha
  local remote_sha
  local need_dashboard_smoke=true
  prod_sha=$(git rev-parse --short prod)

  echo "[8/9] Post-deploy check..."
  echo ""
  echo "  Verificant publicacio remota..."
  git fetch origin --prune --quiet >/dev/null 2>&1 || true
  remote_sha=$(git rev-parse --short refs/remotes/origin/prod 2>/dev/null || true)
  if [ "$remote_sha" != "$prod_sha" ]; then
    POSTDEPLOY_REMOTE_SHA_STATUS="PENDENT"
    DEPLOY_RESULT="PENDENT"
    echo "  SHA remot no confirmat encara. Estat: PENDENT."
  else
    POSTDEPLOY_REMOTE_SHA_STATUS="OK"
    echo "  SHA remot confirmat: $prod_sha"
  fi
  echo ""

  resolve_postdeploy_urls

  if [ "$FAST_PUBLIC_SCOPE" = true ] && [ "$IS_FISCAL" = false ]; then
    need_dashboard_smoke=false
  fi

  if [ -n "$RESOLVED_SMOKE_PUBLIC_URL" ] && { [ "$need_dashboard_smoke" = false ] || [ -n "$RESOLVED_SMOKE_DASHBOARD_URL" ]; }; then
    echo "  Executant smoke checks automatitzats..."
    echo "    URL publica: $RESOLVED_SMOKE_PUBLIC_URL"
    if [ "$need_dashboard_smoke" = true ]; then
      echo "    URL accés:   $RESOLVED_SMOKE_DASHBOARD_URL"
    fi
    local smoke_ok=true
    if ! curl -fsS --max-time 20 "$RESOLVED_SMOKE_PUBLIC_URL" >/dev/null; then
      smoke_ok=false
      DEPLOY_RESULT="PENDENT"
      echo "  Smoke públic no confirmat. Estat: PENDENT."
    fi
    if [ "$need_dashboard_smoke" = true ] && ! curl -fsS --max-time 20 "$RESOLVED_SMOKE_DASHBOARD_URL" >/dev/null; then
      smoke_ok=false
      DEPLOY_RESULT="PENDENT"
      echo "  Smoke dashboard no confirmat. Estat: PENDENT."
    fi
    if [ "$smoke_ok" = true ]; then
      POSTDEPLOY_SMOKE_STATUS="OK"
    else
      POSTDEPLOY_SMOKE_STATUS="PENDENT"
    fi
  else
    POSTDEPLOY_SMOKE_STATUS="PENDENT"
    DEPLOY_RESULT="PENDENT"
    echo "  Smoke automàtic no disponible: no s'han pogut deduir URLs de comprovació."
    echo "  Pots definir DEPLOY_BASE_URL o DEPLOY_SMOKE_PUBLIC_URL/DEPLOY_SMOKE_DASHBOARD_URL."
    echo "  Estat del deploy: PENDENT."
  fi
  echo ""

  if [ -n "$RESOLVED_DEPLOY_BASE_URL" ]; then
    echo "  Verificant contingut public real..."
    local public_ok=true
    if ! wait_for_text_marker \
      "Home pública (/ca)" \
      "${RESOLVED_DEPLOY_BASE_URL}/ca" \
      "Controla donacions"; then
      public_ok=false
    fi
    if ! wait_for_text_marker \
      "Contacte públic (/ca/contact)" \
      "${RESOLVED_DEPLOY_BASE_URL}/ca/contact" \
      "Parlem de la teva entitat"; then
      public_ok=false
    fi
    if ! wait_for_text_marker \
      "Hub econòmic (/ca/gestio-economica-ong)" \
      "${RESOLVED_DEPLOY_BASE_URL}/ca/gestio-economica-ong" \
      "Posa ordre a la gestió econòmica de la teva ONG"; then
      public_ok=false
    fi

    if [ "$public_ok" = false ]; then
      POSTDEPLOY_PUBLIC_CONTENT_STATUS="PENDENT"
      DEPLOY_RESULT="PENDENT"
      echo "  Validació de contingut pendent: alguna ruta pública encara no serveix el text esperat."
    else
      POSTDEPLOY_PUBLIC_CONTENT_STATUS="OK"
    fi
    echo ""
  else
    POSTDEPLOY_PUBLIC_CONTENT_STATUS="NO CAL"
  fi

  if [ "$DEPLOY_RESULT" = "PENDENT" ]; then
    echo "  Post-deploy provisionalment pendent. Continuo amb comprovacions addicionals."
  else
    echo "  Post-deploy confirmat."
  fi
  echo ""
}

post_production_3min_check() {
  CURRENT_PHASE="Post-check 3 minuts"
  echo "[8b/9] Check post-produccio (3 minuts)..."
  echo ""

  if [ "$FAST_PUBLIC_SCOPE" = true ] && [ "$IS_FISCAL" = false ]; then
    POSTDEPLOY_3MIN_STATUS="NO CAL"
    echo "  Check de 3 minuts: NO CAL (scope EDGE rapid)."
    echo ""
    return
  fi

  resolve_postdeploy_urls

  local login_url core_url report_url
  login_url="$RESOLVED_CHECK_LOGIN_URL"
  core_url="$RESOLVED_CHECK_CORE_URL"
  report_url="$RESOLVED_CHECK_REPORT_URL"

  if [ -z "$login_url" ] || [ -z "$core_url" ] || [ -z "$report_url" ]; then
    POSTDEPLOY_3MIN_STATUS="PENDENT"
    DEPLOY_RESULT="PENDENT"
    echo "  Check de 3 minuts no complet: no s'han pogut deduir URLs de comprovació."
    echo "  Pots definir DEPLOY_BASE_URL o DEPLOY_CHECK_LOGIN_URL / DEPLOY_CHECK_CORE_URL / DEPLOY_CHECK_REPORT_URL."
    echo ""
    return
  fi

  wait_for_url() {
    local label="$1"
    local url="$2"
    local i
    for i in $(seq 1 18); do
      if curl -fsS --max-time 20 "$url" >/dev/null 2>&1; then
        echo "  OK: $label"
        return 0
      fi
      sleep 10
    done
    echo "  PENDENT: $label"
    return 1
  }

  local ok_all=true
  if ! wait_for_url "Login" "$login_url"; then ok_all=false; fi
  if ! wait_for_url "Flux principal" "$core_url"; then ok_all=false; fi
  if ! wait_for_url "Informes/export" "$report_url"; then ok_all=false; fi

  if [ "$ok_all" = false ]; then
    POSTDEPLOY_3MIN_STATUS="PENDENT"
    DEPLOY_RESULT="PENDENT"
    echo ""
    echo "  Cal revisio curta: alguna comprovacio post-produccio no s'ha confirmat."
  else
    POSTDEPLOY_3MIN_STATUS="OK"
    echo ""
    echo "  Check post-produccio completat correctament."
  fi
  echo ""
}

run_fiscal_oracle_postdeploy_monitor() {
  CURRENT_PHASE="Oracle fiscal postdeploy"
  echo "[8c/9] Oracle fiscal postdeploy..."
  echo ""

  if [ "$FAST_PUBLIC_SCOPE" = true ] && [ "$IS_FISCAL" = false ]; then
    POSTDEPLOY_ORACLE_STATUS="NO CAL"
    echo "  Oracle fiscal postdeploy: NO CAL (scope EDGE rapid)."
    echo ""
    return
  fi

  if ! node --import tsx "$SCRIPT_DIR/fiscal/run-oracle.ts" --stage=postdeploy; then
    POSTDEPLOY_ORACLE_STATUS="PENDENT"
    DEPLOY_RESULT="PENDENT"
    DEPLOY_BLOCK_REASON="FISCAL_ORACLE_FAIL (postdeploy)"
    echo "  FISCAL_ORACLE_FAIL detectat en monitor postdeploy."
    echo "  Incidència CRITICAL registrada a $INCIDENT_LOG."
    append_incident_log
    echo ""
    return
  fi

  POSTDEPLOY_ORACLE_STATUS="OK"
  echo "  Oracle fiscal postdeploy OK."
  echo ""
}

reconcile_postdeploy_result() {
  CURRENT_PHASE="Reconciliar resultat postdeploy"
  echo "[8d/9] Reconciliant resultat final del deploy..."
  echo ""

  local runtime_checks_ok=true

  if [ "$POSTDEPLOY_SMOKE_STATUS" != "OK" ]; then
    runtime_checks_ok=false
  fi

  if [ "$POSTDEPLOY_PUBLIC_CONTENT_STATUS" = "PENDENT" ]; then
    runtime_checks_ok=false
  fi

  if [ "$POSTDEPLOY_3MIN_STATUS" = "PENDENT" ]; then
    runtime_checks_ok=false
  fi

  if [ "$POSTDEPLOY_ORACLE_STATUS" = "PENDENT" ]; then
    runtime_checks_ok=false
  fi

  if [ "$POSTDEPLOY_REMOTE_SHA_STATUS" = "PENDENT" ] && [ "$runtime_checks_ok" = true ]; then
    DEPLOY_RESULT="OK"
    if [ "$FAST_PUBLIC_SCOPE" = true ] && [ "$IS_FISCAL" = false ]; then
      echo "  SHA remot ha anat tard, pero la publicacio ha quedat confirmada per smoke i contingut public."
    else
      echo "  SHA remot ha anat tard, pero la publicacio ha quedat confirmada per smoke, contingut, check de 3 minuts i oracle."
    fi
    echo "  Resultat final normalitzat a OK."
    echo ""
    return
  fi

  if [ "$DEPLOY_RESULT" = "PENDENT" ]; then
    echo "  Resultat final mantingut a PENDENT: falta confirmacio en alguna comprovacio real."
  else
    echo "  Resultat final confirmat: OK."
  fi
  echo ""
}

# ============================================================
# PAS 9 — Deploy log
# ============================================================
append_deploy_log() {
  CURRENT_PHASE="Registrar deploy"
  echo "[9/9] Registrant al deploy log..."

  local deploy_date
  deploy_date=$(TZ="Europe/Madrid" date '+%Y-%m-%d %H:%M')
  local deploy_sha
  deploy_sha="${DEPLOY_CONTENT_SHA:-$(git rev-parse --short "$DEPLOY_TARGET_BRANCH")}"
  local fiscal_str
  fiscal_str=$([ "$IS_FISCAL" = true ] && echo "Si" || echo "No")

  local log_result="$DEPLOY_RESULT"
  if [ "$GUIDED_ALERT_EMITTED" = true ]; then
    if [ "$log_result" = "OK" ]; then
      log_result="OK_AMB_AVIS"
    elif [ "$log_result" = "PENDENT" ]; then
      log_result="PENDENT_AMB_AVIS"
    fi
  fi

  local log_line="| $deploy_date | $deploy_sha | $RISK_LEVEL | $fiscal_str | $CHANGED_COUNT | $log_result |"

  # Crear DEPLOY-LOG.md si no existeix
  if [ ! -f "$PROJECT_DIR/$DEPLOY_LOG" ]; then
    mkdir -p "$(dirname "$PROJECT_DIR/$DEPLOY_LOG")"
    cat > "$PROJECT_DIR/$DEPLOY_LOG" << 'HEADER'
# Deploy Log — Summa Social

Registre cronologic de desplegaments a produccio.

| Data | SHA | Risc | Fiscal | Fitxers | Resultat |
|------|-----|------|--------|---------|----------|
HEADER
  fi

  # Afegir línia a la taula principal. Si existeixen seccions addicionals,
  # inserim la línia abans de la primera secció per no trencar la taula.
  if grep -Eq "^## Decisions humanes \(negoci\)|^## Decisions i avisos \(negoci\)|^## Avisos guiats \(negoci\)|^## Backup curt predeploy" "$PROJECT_DIR/$DEPLOY_LOG"; then
    local tmp_file
    tmp_file=$(mktemp)
    awk -v line="$log_line" '
      BEGIN { inserted = 0 }
      /^## Decisions humanes \(negoci\)|^## Decisions i avisos \(negoci\)|^## Avisos guiats \(negoci\)|^## Backup curt predeploy/ && inserted == 0 {
        print line
        inserted = 1
      }
      { print }
      END {
        if (inserted == 0) print line
      }
    ' "$PROJECT_DIR/$DEPLOY_LOG" > "$tmp_file"
    mv "$tmp_file" "$PROJECT_DIR/$DEPLOY_LOG"
  else
    echo "$log_line" >> "$PROJECT_DIR/$DEPLOY_LOG"
  fi

  if [ "$DECISION_TAKEN" != "NONE" ]; then
    if ! grep -Eq "^## Decisions humanes \(negoci\)|^## Decisions i avisos \(negoci\)" "$PROJECT_DIR/$DEPLOY_LOG"; then
      cat >> "$PROJECT_DIR/$DEPLOY_LOG" << 'HUMAN_HEADER'

## Decisions i avisos (negoci)

| Data | SHA | context | impacte | decisio |
|------|-----|---------|---------|---------|
HUMAN_HEADER
    fi
    local human_line
    human_line="| $deploy_date | $deploy_sha | $HUMAN_QUESTION_REASON | $BUSINESS_IMPACT | $DECISION_TAKEN |"
    echo "$human_line" >> "$PROJECT_DIR/$DEPLOY_LOG"
  fi

  if [ "$GUIDED_ALERT_EMITTED" = true ]; then
    if ! grep -q "^## Avisos guiats (negoci)" "$PROJECT_DIR/$DEPLOY_LOG"; then
      cat >> "$PROJECT_DIR/$DEPLOY_LOG" << 'GUIDED_HEADER'

## Avisos guiats (negoci)

| Data | SHA | Risc | impacte_possible | recomanacio |
|------|-----|------|------------------|-------------|
GUIDED_HEADER
    fi
    echo "| $deploy_date | $deploy_sha | $RISK_LEVEL | $BUSINESS_IMPACT | $GUIDED_ALERT_RECOMMENDATION |" >> "$PROJECT_DIR/$DEPLOY_LOG"
  fi

  if [ "$BACKUP_RESULT" != "NO_REQUIRED" ] || [ -n "$BACKUP_EXPORT_PATH" ]; then
    if ! grep -q "^## Backup curt predeploy" "$PROJECT_DIR/$DEPLOY_LOG"; then
      cat >> "$PROJECT_DIR/$DEPLOY_LOG" << 'BACKUP_HEADER'

## Backup curt predeploy

| Data | SHA | resultat | export_path |
|------|-----|----------|-------------|
BACKUP_HEADER
    fi
    echo "| $deploy_date | $deploy_sha | $BACKUP_RESULT | ${BACKUP_EXPORT_PATH:--} |" >> "$PROJECT_DIR/$DEPLOY_LOG"
  fi

  echo "  Registrat a $DEPLOY_LOG"
  echo "  $log_line"
  echo ""
}

commit_deploy_logs_if_needed() {
  CURRENT_PHASE="Commit logs deploy"
  echo "[9b/9] Committant logs de deploy (si hi ha canvis)..."
  echo ""

  local tracked_files=("$DEPLOY_LOG" "$ROLLBACK_PLAN_FILE")
  if [ -f "$PROJECT_DIR/$INCIDENT_LOG" ]; then
    tracked_files+=("$INCIDENT_LOG")
  fi

  git add -- "${tracked_files[@]}"

  if git diff --cached --quiet -- "${tracked_files[@]}"; then
    echo "  Sense canvis a logs de deploy. No es crea cap commit."
    echo ""
    return
  fi

  HUSKY=0 git commit -m "chore(deploy): update deploy logs" -- "${tracked_files[@]}"
  MAIN_SHA=$(git rev-parse --short HEAD)
  echo "  Commit de logs creat a $DEPLOY_TARGET_BRANCH."
  echo ""
}

reabsorb_prod_into_target_branch() {
  CURRENT_PHASE="Reabsorbir prod a la branca origen"
  echo "[9c/9] Reabsorbint prod a $DEPLOY_TARGET_BRANCH..."
  echo ""

  git checkout "$DEPLOY_TARGET_BRANCH" --quiet

  if git merge-base --is-ancestor refs/remotes/origin/prod "refs/heads/$DEPLOY_TARGET_BRANCH" >/dev/null 2>&1; then
    echo "  $DEPLOY_TARGET_BRANCH ja conté prod. No cal cap reabsorció."
    echo ""
    return
  fi

  if git merge --no-ff prod -m "chore(branches): reabsorbeix prod a $DEPLOY_TARGET_BRANCH postdeploy" >/dev/null 2>&1; then
    MAIN_SHA=$(git rev-parse --short HEAD)
    echo "  prod reabsorbida correctament a $DEPLOY_TARGET_BRANCH."
    echo ""
    return
  fi

  git merge --abort >/dev/null 2>&1 || true
  DEPLOY_RESULT="PENDENT"
  DEPLOY_BLOCK_REASON="Prod publicada però la branca origen no ha pogut reabsorbir el merge final de prod."
  echo "  PENDENT: la reabsorció automàtica de prod a $DEPLOY_TARGET_BRANCH no s'ha pogut completar."
  echo ""
}

sync_target_branch_after_deploy_logs() {
  CURRENT_PHASE="Sincronitzar branca origen remota"
  echo "[9d/9] Sincronitzant $DEPLOY_TARGET_BRANCH amb origin/$DEPLOY_TARGET_BRANCH..."
  echo ""

  git checkout "$DEPLOY_TARGET_BRANCH" --quiet

  local local_branch_sha remote_branch_sha
  local_branch_sha=$(git rev-parse HEAD)
  remote_branch_sha=$(git rev-parse "refs/remotes/origin/$DEPLOY_TARGET_BRANCH" 2>/dev/null || true)

  if [ -n "$remote_branch_sha" ] && [ "$local_branch_sha" = "$remote_branch_sha" ]; then
    MAIN_REMOTE_SYNC_STATUS="SI"
    echo "  $DEPLOY_TARGET_BRANCH ja estava alineada amb origin/$DEPLOY_TARGET_BRANCH."
    echo ""
    return
  fi

  if git push origin "$DEPLOY_TARGET_BRANCH"; then
    MAIN_REMOTE_SYNC_STATUS="SI"
    MAIN_SHA=$(git rev-parse --short HEAD)
    echo "  origin/$DEPLOY_TARGET_BRANCH actualitzada."
    echo ""
    return
  fi

  MAIN_REMOTE_SYNC_STATUS="NO"
  DEPLOY_RESULT="PENDENT"
  DEPLOY_BLOCK_REASON="Prod publicada però la branca origen remota no s'ha sincronitzat amb els logs de deploy."
  echo "  PENDENT: prod publicada, pero origin/$DEPLOY_TARGET_BRANCH no s'ha pogut sincronitzar."
  echo ""
}

# ============================================================
# MAIN
# ============================================================
main() {
  echo ""
  echo "======================================"
  echo "  SUMMA SOCIAL — DEPLOY VERIFICAT"
  echo "======================================"

  preflight_git_checks      # Pas 1
  detect_changed_files       # Pas 2
  classify_risk              # Pas 3
  enforce_scope_guardrail
  auto_predeploy_backup
  fiscal_impact_gate         # Pas 4
  run_verifications          # Pas 5
  run_fiscal_oracle_predeploy
  display_deploy_summary     # Pas 6
  handle_business_decision_for_residual_risk
  DEPLOY_PROD_BEFORE_SHA=$(git rev-parse --short prod)
  DEPLOY_CONTENT_SHA=$(git rev-parse --short "$DEPLOY_TARGET_BRANCH")
  prepare_rollback_plan
  commit_deploy_logs_if_needed
  DEPLOY_CONTENT_SHA=$(git rev-parse --short "$DEPLOY_TARGET_BRANCH")
  execute_merge_ritual       # Pas 7
  post_deploy_check          # Pas 8
  post_production_3min_check
  run_fiscal_oracle_postdeploy_monitor
  reconcile_postdeploy_result
  prepare_rollback_plan
  append_deploy_log          # Pas 9
  commit_deploy_logs_if_needed
  reabsorb_prod_into_target_branch
  sync_target_branch_after_deploy_logs
  DEPLOY_SUCCESS=1

  echo "  branca origen $DEPLOY_TARGET_BRANCH alineada amb origin/$DEPLOY_TARGET_BRANCH: $MAIN_REMOTE_SYNC_STATUS"
  echo "  DEPLOY COMPLETAT ($DEPLOY_RESULT)."
  echo ""
}

cd "$PROJECT_DIR"
main "$@"
