#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

STATUS_NO="No en producció"
STATUS_READY="Preparat per producció"
STATUS_PROD="A producció"

LOW_RISK_PATTERNS=(
  "^docs/"
  "^src/i18n/"
  "^public/"
  "\\.md$"
  "\\.txt$"
)

HIGH_RISK_PATTERNS=(
  "^src/app/api/"
  "^src/lib/fiscal/"
  "^src/lib/remittances/"
  "^src/lib/sepa/"
  "project-module"
  "fx"
  "exchange"
  "budget"
  "^firestore.rules$"
  "^storage.rules$"
  "^scripts/"
)

LAST_FETCH_OK=true
LAST_COMMIT_MESSAGE=""

cd "$PROJECT_DIR"

GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ -z "$GIT_COMMON_DIR" ]; then
  echo "No s'ha pogut detectar el repositori git." >&2
  exit 1
fi
CONTROL_REPO_DIR="${WORKFLOW_CONTROL_REPO_DIR:-$(cd "$GIT_COMMON_DIR/.." && pwd)}"
WORKFLOW_STATE_DIR="$GIT_COMMON_DIR/workflow-state"
INTEGRATION_LOCK_DIR="$WORKFLOW_STATE_DIR/integration.lock"
INTEGRATION_LOCK_HELD=false

cleanup_integration_lock_on_exit() {
  if [ "$INTEGRATION_LOCK_HELD" != "true" ]; then
    return
  fi
  rm -rf "$INTEGRATION_LOCK_DIR" 2>/dev/null || true
  INTEGRATION_LOCK_HELD=false
}

trap cleanup_integration_lock_on_exit EXIT

say() {
  printf '%s\n' "$1"
}

sanitize_area_slug() {
  local raw="${1:-}"
  printf '%s' "$raw" \
    | tr '[:upper:]' '[:lower:]' \
    | tr '/[:space:]' '-' \
    | tr -cd '[:alnum:]_.-' \
    | sed -E 's/[._]+/-/g; s/^-+//; s/-+$//'
}

ensure_workflow_state_dir() {
  mkdir -p "$WORKFLOW_STATE_DIR"
}

cleanup_stale_integration_lock_if_needed() {
  if [ ! -d "$INTEGRATION_LOCK_DIR" ]; then
    return
  fi

  local pid_file pid
  pid_file="$INTEGRATION_LOCK_DIR/pid"
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [ -z "$pid" ]; then
    rm -rf "$INTEGRATION_LOCK_DIR" 2>/dev/null || true
    return
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    return
  fi

  rm -rf "$INTEGRATION_LOCK_DIR" 2>/dev/null || true
}

acquire_integration_lock() {
  local branch="$1"
  local wait_seconds elapsed start_ts notice_bucket last_notice_bucket active_branch

  ensure_workflow_state_dir
  wait_seconds="${INTEGRATION_LOCK_WAIT_SECONDS:-300}"
  if ! [[ "$wait_seconds" =~ ^[0-9]+$ ]]; then
    wait_seconds=300
  fi

  start_ts="$(date +%s)"
  last_notice_bucket=-1

  while true; do
    if mkdir "$INTEGRATION_LOCK_DIR" 2>/dev/null; then
      printf '%s\n' "$$" > "$INTEGRATION_LOCK_DIR/pid"
      printf '%s\n' "$branch" > "$INTEGRATION_LOCK_DIR/branch"
      INTEGRATION_LOCK_HELD=true
      return 0
    fi

    cleanup_stale_integration_lock_if_needed
    if mkdir "$INTEGRATION_LOCK_DIR" 2>/dev/null; then
      printf '%s\n' "$$" > "$INTEGRATION_LOCK_DIR/pid"
      printf '%s\n' "$branch" > "$INTEGRATION_LOCK_DIR/branch"
      INTEGRATION_LOCK_HELD=true
      return 0
    fi

    elapsed=$(( $(date +%s) - start_ts ))
    if [ "$elapsed" -ge "$wait_seconds" ]; then
      active_branch="$(cat "$INTEGRATION_LOCK_DIR/branch" 2>/dev/null || true)"
      say "BLOCKED_SAFE"
      if [ -n "$active_branch" ]; then
        say "Hi ha una altra integració en curs: $active_branch"
      else
        say "Hi ha una altra integració en curs."
      fi
      say "Torna a dir 'Acabat' en uns minuts."
      return 1
    fi

    notice_bucket=$((elapsed / 15))
    if [ "$notice_bucket" -ne "$last_notice_bucket" ]; then
      say "Esperant torn d'integració..."
      last_notice_bucket="$notice_bucket"
    fi

    sleep 2
  done
}

release_integration_lock() {
  if [ "$INTEGRATION_LOCK_HELD" != "true" ]; then
    return
  fi
  rm -rf "$INTEGRATION_LOCK_DIR" 2>/dev/null || true
  INTEGRATION_LOCK_HELD=false
}

git_control() {
  git -C "$CONTROL_REPO_DIR" "$@"
}

is_control_repo() {
  [ "$(pwd)" = "$CONTROL_REPO_DIR" ]
}

has_changes_in_repo() {
  local repo_dir="$1"
  if [ -n "$(git -C "$repo_dir" status --porcelain --untracked-files=normal)" ]; then
    return 0
  fi
  return 1
}

contains_forbidden_guidance_terms() {
  local text_lower
  text_lower=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  local banned=(
    "git"
    "merge"
    "flag"
    "--no-verify"
    "commit"
    "push"
    "sha"
  )
  local term
  for term in "${banned[@]}"; do
    if printf '%s' "$text_lower" | grep -q -- "$term"; then
      return 0
    fi
  done
  return 1
}

emit_next_step_block() {
  local message="$1"
  say ""
  say "SEGÜENT PAS RECOMANAT"
  say "- $message"
}

infer_non_technical_summary_lines() {
  local files="$1"
  local risk="$2"

  local done_line implication_line visible_line

  if printf '%s\n' "$files" | grep -Eq '^scripts/|^docs/|^CLAUDE\.md$|^package\.json$'; then
    done_line="s'ha ajustat el procés guiat de treball i publicació per fer-lo més clar."
    implication_line="ara el recorregut és més assistit i redueix errors de coordinació."
    visible_line="rebràs indicacions més clares sobre quan tancar i quan publicar."
  elif printf '%s\n' "$files" | grep -Eq '^src/lib/fiscal/|^src/lib/remittances/|^src/lib/sepa/|^src/app/api/remittances/'; then
    done_line="s'ha reforçat el tractament de moviments i fiscalitat."
    implication_line="es redueix el risc d'inconsistències econòmiques."
    visible_line="es poden veure validacions més estrictes en fluxos sensibles."
  elif printf '%s\n' "$files" | grep -Eq '^src/app/api/|^firestore\.rules$|^storage\.rules$'; then
    done_line="s'ha ajustat el control d'accés i el tractament intern de dades."
    implication_line="es protegeix millor la informació sensible."
    visible_line="es poden veure missatges de bloqueig més clars quan falta informació."
  elif printf '%s\n' "$files" | grep -Eq '^src/components/|^src/app/|^src/hooks/'; then
    done_line="s'ha millorat el flux d'ús a pantalles clau."
    implication_line="l'operativa diària és més clara i consistent."
    visible_line="es poden notar canvis en recorreguts, textos o validacions visuals."
  elif printf '%s\n' "$files" | grep -Eq '^src/i18n/|^public/|^docs/'; then
    done_line="s'han actualitzat textos i guies de suport."
    implication_line="la comunicació és més clara i coherent."
    visible_line="es notaran millores en missatges i documentació."
  else
    done_line="s'han aplicat millores de funcionament."
    implication_line="el sistema queda més robust i coherent."
    visible_line="es poden notar ajustos puntuals en alguns fluxos."
  fi

  if [ "$risk" = "ALT" ]; then
    implication_line="$implication_line El risc funcional és sensible i està sota control amb comprovacions."
  elif [ "$risk" = "MITJA" ]; then
    implication_line="$implication_line L'impacte és moderat i controlat."
  else
    implication_line="$implication_line L'impacte és baix."
  fi

  printf '%s\n%s\n%s\n' "$done_line" "$implication_line" "$visible_line"
}

emit_pre_acabat_summary() {
  local files="$1"
  local risk="$2"
  local summary
  summary="$(infer_non_technical_summary_lines "$files" "$risk")"

  local done_line implication_line visible_line
  done_line=$(printf '%s\n' "$summary" | sed -n '1p')
  implication_line=$(printf '%s\n' "$summary" | sed -n '2p')
  visible_line=$(printf '%s\n' "$summary" | sed -n '3p')

  if contains_forbidden_guidance_terms "$done_line $implication_line $visible_line"; then
    say ""
    say "RESUM NO TÈCNIC"
    say "- Què s'ha fet: cal concretar millor l'impacte abans de tancar."
    say "- Implicació: encara no queda prou clar què canvia per a l'entitat."
    say "- Què pot notar l'entitat: pendent de concretar."
    emit_next_step_block "Continua implementació fins que l'impacte sigui clar."
    return 1
  fi

  say ""
  say "RESUM NO TÈCNIC"
  say "- Què s'ha fet: $done_line"
  say "- Implicació: $implication_line"
  say "- Què pot notar l'entitat: $visible_line"
  return 0
}

emit_authoritzo_deploy_meaning() {
  say ""
  say "QUÈ VOL DIR AUTORITZO DEPLOY"
  say "- Dir \"Autoritzo deploy\" vol dir publicar els canvis preparats a producció."
  say "- Es faran comprovacions automàtiques abans i després de publicar."
  say "- Si alguna comprovació falla, no es publica."
  say "- L'entitat podria notar els canvis immediatament."
}

emit_guidance_for_status() {
  local status="$1"

  if [ "$status" = "$STATUS_READY" ]; then
    emit_authoritzo_deploy_meaning
    emit_next_step_block "Si vols publicar ara, pots dir: Autoritzo deploy"
    return
  fi

  if [ "$status" = "$STATUS_PROD" ]; then
    emit_next_step_block "El procés està complet. No cal cap acció obligatòria."
    return
  fi

  emit_next_step_block "Pots començar dient: Inicia o Implementa"
}

current_branch() {
  git rev-parse --abbrev-ref HEAD
}

head_needs_integration_on_control_main() {
  local head_sha="$1"

  if git_control merge-base --is-ancestor "$head_sha" main 2>/dev/null; then
    return 1
  fi

  return 0
}

refresh_origin() {
  if git fetch origin --quiet >/dev/null 2>&1; then
    LAST_FETCH_OK=true
    return 0
  fi

  LAST_FETCH_OK=false
  return 0
}

matches_any_pattern() {
  local value="$1"
  shift
  local pattern
  for pattern in "$@"; do
    if printf '%s\n' "$value" | grep -Eq "$pattern"; then
      return 0
    fi
  done
  return 1
}

collect_changed_files() {
  (
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  ) | awk 'NF' | sort -u
}

has_local_changes() {
  local files
  files=$(
    (
      git diff --name-only
      git diff --cached --name-only
      git ls-files --others --exclude-standard
    ) | awk 'NF' | sort -u
  )

  if [ -z "$files" ]; then
    return 1
  fi

  local file
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    return 0
  done <<EOF2
$files
EOF2

  return 1
}

classify_risk() {
  local files="$1"

  if [ -z "$files" ]; then
    printf '%s' "BAIX"
    return
  fi

  local has_high=false
  local all_low=true
  local file

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    if matches_any_pattern "$file" "${HIGH_RISK_PATTERNS[@]}"; then
      has_high=true
    fi

    if ! matches_any_pattern "$file" "${LOW_RISK_PATTERNS[@]}"; then
      all_low=false
    fi
  done <<EOF2
$files
EOF2

  if [ "$has_high" = true ]; then
    printf '%s' "ALT"
    return
  fi

  if [ "$all_low" = true ]; then
    printf '%s' "BAIX"
    return
  fi

  printf '%s' "MITJA"
}

stage_changes() {
  git add -A
  if git diff --cached --quiet; then
    return 1
  fi
  return 0
}

run_checks() {
  bash "$SCRIPT_DIR/verify-local.sh"
  bash "$SCRIPT_DIR/verify-ci.sh"
}

collect_staged_files() {
  git diff --cached --name-only --diff-filter=ACMRT | awk 'NF'
}

guard_no_prohibited_staged_paths() {
  local staged blocked first_path
  staged="$(collect_staged_files)"

  if [ -z "$staged" ]; then
    return 0
  fi

  blocked="$(printf '%s\n' "$staged" | grep -E '(^|/)node_modules/|^functions/node_modules/|(^|/)\.next/|(^|/)dist/' || true)"

  if [ -z "$blocked" ]; then
    return 0
  fi

  first_path="$(printf '%s\n' "$blocked" | sed -n '1p')"
  say "$STATUS_NO"
  say "S'han detectat fitxers staged prohibits (deps/build/cache)."
  say "Treure'ls de staging abans de continuar:"
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    say "- $path"
  done <<EOF2
$blocked
EOF2
  say "Comanda recomanada: git reset $first_path"
  exit 1
}

all_files_match_patterns() {
  local files="$1"
  shift
  local file pattern matched

  while IFS= read -r file; do
    [ -z "$file" ] && continue
    matched=false
    for pattern in "$@"; do
      if printf '%s\n' "$file" | grep -Eq "$pattern"; then
        matched=true
        break
      fi
    done
    if [ "$matched" = false ]; then
      return 1
    fi
  done <<EOF2
$files
EOF2

  return 0
}

infer_commit_message() {
  local risk="$1"
  local files file_count type scope summary
  files="$(collect_staged_files)"
  file_count=$(printf '%s\n' "$files" | awk 'NF' | wc -l | tr -d ' ')

  if [ -n "${COMMIT_MESSAGE:-}" ]; then
    printf '%s' "$COMMIT_MESSAGE"
    return
  fi

  if [ -z "$files" ]; then
    printf '%s' "chore(app): actualitza canvis pendents [risc $risk]"
    return
  fi

  if all_files_match_patterns "$files" '^docs/' '\\.md$' '\\.txt$'; then
    type="docs"
    scope="docs"
    summary="actualitza documentacio funcional"
  elif all_files_match_patterns "$files" '^src/i18n/' '^public/' '^docs/' '\\.md$' '\\.txt$'; then
    type="chore"
    scope="i18n"
    summary="actualitza textos i contingut public"
  elif printf '%s\n' "$files" | grep -Eq '^src/app/api/'; then
    type="feat"
    scope="api"
    summary="actualitza fluxos de dades i validacions"
  elif printf '%s\n' "$files" | grep -Eq '^src/components/|^src/app/'; then
    type="feat"
    scope="ui"
    summary="actualitza comportament visible de l aplicacio"
  elif printf '%s\n' "$files" | grep -Eq '^src/lib/|^functions/'; then
    type="feat"
    scope="core"
    summary="actualitza logica interna i robustesa"
  elif printf '%s\n' "$files" | grep -Eq '^scripts/'; then
    type="chore"
    scope="ops"
    summary="actualitza automatitzacions i guardrails"
  elif printf '%s\n' "$files" | grep -Eq '^firestore.rules$|^storage.rules$'; then
    type="chore"
    scope="rules"
    summary="actualitza regles de seguretat"
  else
    type="chore"
    scope="app"
    summary="actualitza funcionalitat del projecte"
  fi

  printf '%s' "$type($scope): $summary [$file_count fitxers, risc $risk]"
}

commit_changes() {
  local risk="$1"
  local commit_message
  commit_message="$(infer_commit_message "$risk")"
  LAST_COMMIT_MESSAGE="$commit_message"
  git commit -m "$commit_message"
}

push_branch() {
  local branch="$1"
  if [[ "$branch" == codex/* ]]; then
    if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
      git push -u origin "$branch"
      return
    fi
    git push
    return
  fi

  git push -u origin "$branch"
}

build_area_branch_name() {
  local area_slug="$1"
  local base candidate counter

  base="codex/${area_slug}-$(date '+%Y%m%d-%H%M%S')"
  candidate="$base"
  counter=1

  while git_control show-ref --verify --quiet "refs/heads/$candidate"; do
    candidate="${base}-${counter}"
    counter=$((counter + 1))
  done

  printf '%s' "$candidate"
}

find_active_branch_for_area() {
  local area_slug="$1"
  local branch

  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    if [[ "$branch" != codex/"$area_slug"-* ]]; then
      continue
    fi
    if git_control merge-base --is-ancestor "$branch" main >/dev/null 2>&1; then
      continue
    fi
    printf '%s' "$branch"
    return 0
  done < <(git_control worktree list --porcelain | awk '
    $1=="branch" {
      sub("refs/heads/", "", $2)
      print $2
    }
  ')

  printf '%s' ""
}

ensure_control_repo_for_deploy_or_merge() {
  local control_branch
  control_branch="$(git_control rev-parse --abbrev-ref HEAD)"

  if [ "$control_branch" != "main" ]; then
    say "$STATUS_NO"
    say "El repositori de control ha d'estar a main abans d'integrar o publicar."
    exit 1
  fi

  if has_changes_in_repo "$CONTROL_REPO_DIR"; then
    say "$STATUS_NO"
    say "El repositori de control ha d'estar net abans d'integrar o publicar."
    exit 1
  fi
}

dry_run_integrate_to_main() {
  local branch="$1"

  ensure_control_repo_for_deploy_or_merge

  if ! git_control pull --ff-only origin main >/dev/null 2>&1; then
    say "$STATUS_NO"
    say "No s'ha pogut actualitzar main al repositori de control."
    return 1
  fi

  if ! git_control merge --no-commit --no-ff "$branch" >/dev/null 2>&1; then
    git_control merge --abort >/dev/null 2>&1 || git_control reset --merge >/dev/null 2>&1 || true
    return 1
  fi

  git_control merge --abort >/dev/null 2>&1 || git_control reset --merge >/dev/null 2>&1 || true
  return 0
}

integrate_to_main() {
  local branch="$1"

  if [ "$branch" = "main" ]; then
    say "$STATUS_NO"
    say "No es pot tancar una tasca directament des de main."
    exit 1
  fi

  ensure_control_repo_for_deploy_or_merge

  if ! git_control pull --ff-only origin main; then
    say "$STATUS_NO"
    say "No s'ha pogut actualitzar main al repositori de control."
    exit 1
  fi

  if ! git_control merge --no-ff "$branch" -m "chore(merge): integra $branch"; then
    git_control merge --abort || true
    say "$STATUS_NO"
    say "Hi ha conflicte d'integració. El canvi queda guardat a $branch."
    exit 1
  fi

  if ! git_control push origin main; then
    say "$STATUS_NO"
    say "No s'ha pogut pujar main després de la integració."
    exit 1
  fi
}

compute_repo_status() {
  refresh_origin

  if has_local_changes; then
    printf '%s' "$STATUS_NO"
    return
  fi

  local main_sha prod_sha head_sha
  main_sha=$(git rev-parse --verify refs/remotes/origin/main 2>/dev/null || true)
  prod_sha=$(git rev-parse --verify refs/remotes/origin/prod 2>/dev/null || true)
  head_sha=$(git rev-parse HEAD)

  if [ -z "$main_sha" ] || [ -z "$prod_sha" ]; then
    printf '%s' "$STATUS_NO"
    return
  fi

  if [ "$main_sha" = "$prod_sha" ]; then
    if git merge-base --is-ancestor "$head_sha" "$main_sha" 2>/dev/null; then
      printf '%s' "$STATUS_PROD"
      return
    fi
    printf '%s' "$STATUS_NO"
    return
  fi

  if git merge-base --is-ancestor "$head_sha" "$main_sha" 2>/dev/null; then
    printf '%s' "$STATUS_READY"
    return
  fi

  printf '%s' "$STATUS_NO"
}

require_clean_tree_for_publica() {
  if has_local_changes; then
    say "$STATUS_NO"
    say "Abans de publicar, cal tancar els canvis pendents amb 'acabat'."
    exit 1
  fi
}

run_inicia() {
  local mode="${1:-auto}"
  local area_arg=""
  local area_slug=""
  local busy_branch=""
  local task_branch=""

  if [ "$mode" = "main" ]; then
    say "El mode 'main' queda substituït per worktree-first."
  elif [ -n "$mode" ] && [ "$mode" != "auto" ]; then
    area_arg="$mode"
    area_slug="$(sanitize_area_slug "$area_arg")"
    if [ -z "$area_slug" ]; then
      area_slug="general"
    fi
  fi

  say "$STATUS_NO"

  if [ -n "$area_slug" ] && [ "$area_slug" != "general" ]; then
    busy_branch="$(find_active_branch_for_area "$area_slug")"
    if [ -n "$busy_branch" ]; then
      say "BLOCKED_SAFE"
      say "Aquesta àrea ja té una tasca activa: $busy_branch"
      say "Per evitar solapaments, primer integra o tanca aquesta tasca."
      exit 1
    fi

    task_branch="$(build_area_branch_name "$area_slug")"
    if ! bash "$SCRIPT_DIR/worktree.sh" create --branch "$task_branch"; then
      exit 1
    fi
  else
    if ! bash "$SCRIPT_DIR/worktree.sh" create; then
      exit 1
    fi
  fi

  emit_next_step_block "Continua implementació dins del worktree creat. Quan estigui llest, digues Acabat des d'allà."
}

run_acabat() {
  local legacy_arg="${1:-}"
  local final_status branch control_branch control_main_ref control_main_sha ahead_count
  local changed_files risk
  branch="$(current_branch)"

  if [ -n "$legacy_arg" ] && [ "$legacy_arg" != "--allow-main-merge" ]; then
    say "BLOCKED_SAFE"
    say "Argument no reconegut per 'acabat': $legacy_arg"
    say "No cal cap opció manual per integrar."
    exit 1
  fi

  if [ "$branch" = "HEAD" ]; then
    say "$STATUS_NO"
    say "No puc continuar en estat detached HEAD."
    exit 1
  fi

  if [ "$branch" = "prod" ]; then
    say "$STATUS_NO"
    say "No treballo mai directament a prod."
    exit 1
  fi

  if [ "$branch" = "main" ] && ! is_control_repo; then
    say "$STATUS_NO"
    say "Aquest worktree no pot treballar directament a main."
    exit 1
  fi

  changed_files="$(collect_changed_files)"
  if [ -n "$changed_files" ]; then
    risk="$(classify_risk "$changed_files")"
    if ! run_checks; then
      say "BLOCKED_SAFE"
      say "Les comprovacions automàtiques han fallat. Cal corregir abans d'integrar."
      exit 1
    fi

    if ! stage_changes; then
      say "BLOCKED_SAFE"
      say "No s'han pogut preparar canvis per tancar la tasca."
      exit 1
    fi
    guard_no_prohibited_staged_paths

    commit_changes "$risk"
    say "Canvis validats i desats per tancar la tasca."
  fi

  if ! git_control fetch origin --quiet >/dev/null 2>&1; then
    say "BLOCKED_SAFE"
    say "No s'ha pogut actualitzar el repositori de control des d'origin."
    exit 1
  fi

  control_branch="$(git_control branch --show-current)"
  if [ "$control_branch" != "main" ]; then
    say "BLOCKED_SAFE"
    say "El repositori de control no és a main. Ves a $CONTROL_REPO_DIR i posa'l a main per integrar."
    exit 1
  fi

  control_main_ref="main"
  if ! git_control rev-parse --verify "$control_main_ref" >/dev/null 2>&1; then
    say "BLOCKED_SAFE"
    say "No s'ha trobat la referència $control_main_ref per calcular integració."
    exit 1
  fi

  control_main_sha="$(git_control rev-parse "$control_main_ref")"
  ahead_count="$(git rev-list --count "${control_main_sha}..HEAD")"
  if [ "$ahead_count" -eq 0 ]; then
    final_status="$(compute_repo_status)"
    say "$final_status"
    say "No hi ha canvis nous per tancar."
    emit_guidance_for_status "$final_status"
    return
  fi

  if [ "$branch" = "main" ]; then
    say "BLOCKED_SAFE"
    say "No es permeten passos destructius des de main."
    exit 1
  fi

  say "No hi ha canvis locals nous, pero la branca te commits pendents d'integrar."
  push_branch "$branch"

  if ! acquire_integration_lock "$branch"; then
    exit 1
  fi

  if ! dry_run_integrate_to_main "$branch"; then
    release_integration_lock
    say "BLOCKED_SAFE"
    say "S'ha detectat un solapament amb canvis recents a main."
    say "El teu canvi queda guardat a $branch fins resoldre la integració."
    exit 1
  fi

  integrate_to_main "$branch"
  release_integration_lock

  final_status="$(compute_repo_status)"
  say "$final_status"
  emit_guidance_for_status "$final_status"
  say ""
  say "PREGUNTA OPERATIVA"
  say "- Vols tancar aquest worktree de tasca ara? (recomanat: npm run worktree:close)"
}

run_publica() {
  local final_status

  if ! is_control_repo; then
    say "$STATUS_NO"
    say "La publicació només es pot executar des del repositori de control: $CONTROL_REPO_DIR"
    exit 1
  fi

  if [ "$(current_branch)" != "main" ]; then
    say "$STATUS_NO"
    say "La publicació només es pot executar des de main al repositori de control."
    exit 1
  fi

  guard_no_prohibited_staged_paths
  require_clean_tree_for_publica
  ensure_control_repo_for_deploy_or_merge

  if ! git pull --ff-only origin main; then
    say "$STATUS_NO"
    say "No s'ha pogut actualitzar main abans de publicar."
    exit 1
  fi

  if ! bash "$SCRIPT_DIR/deploy.sh"; then
    final_status="$(compute_repo_status)"
    say "$final_status"
    emit_guidance_for_status "$final_status"
    exit 1
  fi

  say "$STATUS_PROD"
  emit_guidance_for_status "$STATUS_PROD"
}

run_estat() {
  local final_status changed_files risk
  final_status="$(compute_repo_status)"
  say "$final_status"

  if has_local_changes; then
    changed_files="$(collect_changed_files)"
    risk="$(classify_risk "$changed_files")"
    if emit_pre_acabat_summary "$changed_files" "$risk"; then
      emit_next_step_block "Si aquest resum és correcte, pots dir: Acabat"
    else
      emit_next_step_block "Continua implementació fins que l'impacte sigui clar."
    fi
    return
  fi

  emit_guidance_for_status "$final_status"
}

main() {
  local cmd="${1:-}"
  local arg1="${2:-}"

  if [ -z "$cmd" ]; then
    say "Us: bash scripts/workflow.sh [inicia [area]|implementa [area]|acabat|publica|estat]"
    exit 1
  fi

  case "$cmd" in
    inicia)
      run_inicia "$arg1"
      ;;
    implementa)
      run_inicia "$arg1"
      ;;
    acabat)
      run_acabat "$arg1"
      ;;
    publica)
      run_publica
      ;;
    estat)
      run_estat
      ;;
    *)
      say "Comanda desconeguda: $cmd"
      say "Us: bash scripts/workflow.sh [inicia [area]|implementa [area]|acabat|publica|estat]"
      exit 1
      ;;
  esac
}

main "$@"
