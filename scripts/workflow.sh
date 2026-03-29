#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/change-profile.sh"

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

emit_worktree_warning_if_needed() {
  local worktree_count
  worktree_count="$(git worktree list | wc -l | tr -d ' ')"

  if ! [[ "$worktree_count" =~ ^[0-9]+$ ]]; then
    return
  fi

  if [ "$worktree_count" -lt 10 ]; then
    return
  fi

  say ""
  say "WARNING"
  say "- worktrees actius: $worktree_count"
  say "- s'acosta el límit operatiu; revisa 'npm run worktree:list' o 'npm run worktree:gc' abans de continuar"
}

emit_acabat_completion() {
  local branch="$1"

  say ""
  say "ESTAT"
  say "- branca: $branch"
  say "- commit pujat: SI"
  say "- llest per integració: SI"
  say ""
  say "SEGÜENT PAS RECOMANAT"
  say "- aquesta feina està llesta però NO integrada a main"
  say "- per integrar: executar npm run integra"
}

current_branch() {
  git rev-parse --abbrev-ref HEAD
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
  local files="$1"
  local verify_profile

  verify_profile="$(summa_change_profile "$files")"
  if [ "$verify_profile" = "FAST_PUBLIC" ]; then
    say "Perfil de validacio: FAST_PUBLIC (scope EDGE)."
  fi

  VERIFY_PROFILE="$verify_profile" bash "$SCRIPT_DIR/verify-local.sh"
  VERIFY_PROFILE="$verify_profile" bash "$SCRIPT_DIR/verify-ci.sh"
}

collect_staged_files() {
  git diff --cached --name-only --diff-filter=ACMRT | awk 'NF'
}

collect_publish_files() {
  git diff --name-only "prod..main" --diff-filter=ACMRT | awk 'NF'
}

guard_publish_scope() {
  local files="$1"
  local scope_eval

  [ -n "$files" ] || return 0

  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"

  if [ "$SCOPE" = "edge" ] && [ "$TOUCHES_CORE_INDIRECTLY" = "true" ]; then
    say "$STATUS_NO"
    say "EDGE intentant tocar CORE."
    say "Aquest deploy queda bloquejat i ha de passar pel circuit estricte."
    exit 1
  fi
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

  bash "$SCRIPT_DIR/worktree.sh" gc --quiet >/dev/null 2>&1 || true

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
  local branch changed_files risk
  branch="$(current_branch)"

  if [ -n "$legacy_arg" ]; then
    say "BLOCKED_SAFE"
    say "Argument no reconegut per 'acabat': $legacy_arg"
    say "La integració ara és explícita i es fa amb: npm run integra"
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

  if [ "$branch" = "main" ]; then
    say "BLOCKED_SAFE"
    say "No es pot executar 'acabat' directament des de main."
    say "Mou la feina a una branca codex/* i integra després amb npm run integra."
    exit 1
  fi

  if [[ "$branch" != codex/* ]]; then
    say "BLOCKED_SAFE"
    say "La branca actual no segueix el flux segur de tasques."
    say "Executa 'acabat' només des d'una branca codex/*."
    exit 1
  fi

  emit_worktree_warning_if_needed

  changed_files="$(collect_changed_files)"
  if [ -n "$changed_files" ]; then
    risk="$(classify_risk "$changed_files")"
    if ! run_checks "$changed_files"; then
      say "BLOCKED_SAFE"
      say "Les comprovacions automàtiques han fallat. Cal corregir abans de marcar la branca com a llesta."
      exit 1
    fi

    if ! stage_changes; then
      say "BLOCKED_SAFE"
      say "No s'han pogut preparar canvis per tancar la tasca."
      exit 1
    fi
    guard_no_prohibited_staged_paths

    commit_changes "$risk"
    say "Canvis validats i desats a la branca de feina."
  else
    say "No hi ha canvis locals nous; es revisarà només la pujada de la branca."
  fi

  if ! push_branch "$branch"; then
    say "BLOCKED_SAFE"
    say "No s'ha pogut pujar la branca $branch a origin."
    exit 1
  fi

  emit_acabat_completion "$branch"
}

run_publica() {
  local publish_files

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
  publish_files="$(collect_publish_files)"
  guard_publish_scope "$publish_files"
  if ! bash "$SCRIPT_DIR/status.sh" gate publica; then
    say "$STATUS_NO"
    exit 1
  fi

  if ! bash "$SCRIPT_DIR/deploy.sh"; then
    bash "$SCRIPT_DIR/status.sh"
    exit 1
  fi

  say "$STATUS_PROD"
  emit_guidance_for_status "$STATUS_PROD"
}

run_estat() {
  bash "$SCRIPT_DIR/status.sh"
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
