#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUIRED_CONTROL_REPO="/Users/raulvico/Documents/summa-social"

RESULT_STATUS="OK"
MERGE_PROBE_STATUS="NO CAL"
TYPEGEN_STATUS="NO CAL"
TYPECHECK_STATUS="NO CAL"
TEST_NODE_STATUS="NO CAL"
MAIN_LOCAL_STATUS="NO"
ORIGIN_MAIN_STATUS="NO"
MAIN_CLEAN_STATUS="NO"
declare -a INTEGRATED_BRANCHES=()
declare -a CONFLICT_ITEMS=()
declare -a READY_BRANCHES=()
declare -a SELECTED_BRANCHES=()
VALIDATION_WORKTREE=""
CONTROL_ORIGIN_MAIN_SHA=""

say() {
  printf '%s\n' "$1"
}

print_list_or_empty() {
  if [ "$#" -eq 0 ]; then
    say "- cap"
    return
  fi

  local item
  for item in "$@"; do
    say "- $item"
  done
}

array_length() {
  local name="$1"
  local had_nounset=0
  local value=0

  case $- in
    *u*)
      had_nounset=1
      set +u
      ;;
  esac

  eval "value=\${#$name[@]}"

  if [ "$had_nounset" -eq 1 ]; then
    set -u
  fi

  printf '%s' "$value"
}

array_values() {
  local name="$1"
  local had_nounset=0

  case $- in
    *u*)
      had_nounset=1
      set +u
      ;;
  esac

  eval "printf '%s\n' \"\${$name[@]}\""

  if [ "$had_nounset" -eq 1 ]; then
    set -u
  fi
}

refresh_control_repo_flags() {
  local local_main_sha remote_main_sha

  if [ -n "$(git -C "$REQUIRED_CONTROL_REPO" status --short 2>/dev/null || true)" ]; then
    MAIN_CLEAN_STATUS="NO"
  else
    MAIN_CLEAN_STATUS="SI"
  fi

  local_main_sha="$(git -C "$REQUIRED_CONTROL_REPO" rev-parse HEAD 2>/dev/null || true)"
  remote_main_sha="$(git -C "$REQUIRED_CONTROL_REPO" rev-parse refs/remotes/origin/main 2>/dev/null || true)"
  if [ -n "$local_main_sha" ] && [ -n "$remote_main_sha" ] && [ "$local_main_sha" = "$remote_main_sha" ]; then
    MAIN_LOCAL_STATUS="SI"
  else
    MAIN_LOCAL_STATUS="NO"
  fi
}

print_summary() {
  local pending_count integrated_count
  refresh_control_repo_flags
  pending_count="$(count_remaining_ready_branches)"
  integrated_count="$(array_length INTEGRATED_BRANCHES)"

  say ""
  say "RESULTAT: INTEGRACIÓ $RESULT_STATUS"
  say ""
  say "BRANQUES INTEGRADES"
  if [ "$(array_length INTEGRATED_BRANCHES)" -eq 0 ]; then
    say "- cap"
  else
    while IFS= read -r item; do
      [ -z "$item" ] && continue
      say "- $item"
    done < <(array_values INTEGRATED_BRANCHES)
  fi
  say ""
  say "CONFLICTES / BLOQUEJOS"
  if [ "$(array_length CONFLICT_ITEMS)" -eq 0 ]; then
    say "- cap"
  else
    while IFS= read -r item; do
      [ -z "$item" ] && continue
      say "- $item"
    done < <(array_values CONFLICT_ITEMS)
  fi
  say ""
  say "VALIDACIONS"
  say "- merge de prova: $MERGE_PROBE_STATUS"
  say "- next typegen: $TYPEGEN_STATUS"
  say "- typecheck: $TYPECHECK_STATUS"
  say "- test:node: $TEST_NODE_STATUS"
  say ""
  say "ESTAT FINAL"
  say "- origin/main actualitzat en aquesta execució: $ORIGIN_MAIN_STATUS"
  say "- main alineada amb origin/main: $MAIN_LOCAL_STATUS"
  say "- main neta: $MAIN_CLEAN_STATUS"
  say "- branques integrades: $integrated_count"
  say "- pendent d'integrar: $pending_count"
  say ""
  say "SEGÜENT PAS RECOMANAT"
  if [ "$RESULT_STATUS" = "OK" ] && [ "$integrated_count" -gt 0 ]; then
    say "- main queda preparada per decidir deploy si aquest bloc és coherent"
    say "- si ja no necessites el worktree integrat, pots tancar-lo amb npm run worktree:close <branca>"
  elif [ "$RESULT_STATUS" = "OK" ]; then
    say "- no hi havia cap branca pendent d'integrar"
  else
    say "- corregeix el bloqueig i torna a executar npm run integra"
  fi
}

cleanup_validation_worktree() {
  if [ -z "$VALIDATION_WORKTREE" ]; then
    return
  fi

  if [ -d "$VALIDATION_WORKTREE" ]; then
    git -C "$VALIDATION_WORKTREE" merge --abort >/dev/null 2>&1 || true
    rm -f "$VALIDATION_WORKTREE/.env.local" "$VALIDATION_WORKTREE/.env.demo" "$VALIDATION_WORKTREE/node_modules"
    rm -rf "$VALIDATION_WORKTREE/.next"
    git -C "$REQUIRED_CONTROL_REPO" worktree remove "$VALIDATION_WORKTREE" >/dev/null 2>&1 || true
    rm -rf "$VALIDATION_WORKTREE" >/dev/null 2>&1 || true
  fi

  VALIDATION_WORKTREE=""
}

trap cleanup_validation_worktree EXIT

fail_with_message() {
  local message="$1"
  RESULT_STATUS="KO"
  CONFLICT_ITEMS+=("$message")
  print_summary
  exit 1
}

trim_branch_line() {
  printf '%s' "$1" | sed -E 's/^[*+] //; s/^  //'
}

array_contains() {
  local needle="$1"
  shift

  local item
  for item in "$@"; do
    if [ "$item" = "$needle" ]; then
      return 0
    fi
  done

  return 1
}

branch_description() {
  local branch="$1"
  local subject

  subject="$(git log -1 --pretty=format:%s "origin/$branch" 2>/dev/null || true)"
  if [ -n "$subject" ]; then
    printf '%s' "$subject"
    return 0
  fi

  printf '%s' "sense descripció inferible"
}

count_remaining_pending_branches() {
  local branch remaining_count
  remaining_count=0

  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    if array_contains "$branch" $(array_values INTEGRATED_BRANCHES); then
      continue
    fi
    remaining_count=$((remaining_count + 1))
  done < <(array_values READY_BRANCHES)

  printf '%s' "$remaining_count"
}

count_remaining_ready_branches() {
  count_remaining_pending_branches
}

discover_ready_branches() {
  eval "$(bash "$PROJECT_DIR/scripts/worktree.sh" report --format shell)"

  local normalized branch
  normalized="${WORKTREE_READY_BRANCHES:-}"
  if [ -z "$normalized" ]; then
    return 0
  fi

  IFS=',' read -r -a READY_BRANCHES <<< "$normalized"
  local kept=()
  for branch in "${READY_BRANCHES[@]}"; do
    [ -z "$branch" ] && continue
    kept+=("$branch")
  done
  READY_BRANCHES=("${kept[@]}")
}

show_ready_branches() {
  local branch description index

  say "BRANQUES LLESTES PER INTEGRAR"
  if [ "$(array_length READY_BRANCHES)" -eq 0 ]; then
    say "- cap"
    return
  fi

  index=1
  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    description="$(branch_description "$branch")"
    say "- [$index] $branch -> $description"
    index=$((index + 1))
  done < <(array_values READY_BRANCHES)

  say ""
  say "RECOMANACIÓ"
  say "- el sistema només admet una branca llesta per integrar cada vegada"
}

select_branch_to_integrate() {
  local branch

  if [ "$(array_length READY_BRANCHES)" -eq 0 ]; then
    return 0
  fi

  if [ "$(array_length READY_BRANCHES)" -gt 1 ]; then
    fail_with_message "Hi ha més d'una branca llesta per integrar. Redueix-ho a una sola veritat de treball."
  fi

  branch="$(array_values READY_BRANCHES | sed -n '1p')"
  [ -n "$branch" ] || fail_with_message "No s'ha pogut determinar la branca llesta per integrar."
  SELECTED_BRANCHES=("$branch")
}

prepare_validation_runtime() {
  local repo_dir="$1"

  if [ ! -d "$REQUIRED_CONTROL_REPO/node_modules" ]; then
    fail_with_message "Falta node_modules al repositori de control. Cal preparar l'entorn abans d'integrar."
  fi

  [ -e "$repo_dir/.env.local" ] || [ ! -f "$REQUIRED_CONTROL_REPO/.env.local" ] || ln -s "$REQUIRED_CONTROL_REPO/.env.local" "$repo_dir/.env.local"
  [ -e "$repo_dir/.env.demo" ] || [ ! -f "$REQUIRED_CONTROL_REPO/.env.demo" ] || ln -s "$REQUIRED_CONTROL_REPO/.env.demo" "$repo_dir/.env.demo"
  [ -e "$repo_dir/node_modules" ] || ln -s "$REQUIRED_CONTROL_REPO/node_modules" "$repo_dir/node_modules"
}

create_validation_worktree() {
  VALIDATION_WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/summa-integra.XXXXXX")"
  git worktree add --detach "$VALIDATION_WORKTREE" main >/dev/null
  prepare_validation_runtime "$VALIDATION_WORKTREE"
}

record_merge_conflicts_from_validation_worktree() {
  local conflicts

  conflicts="$(git -C "$VALIDATION_WORKTREE" diff --name-only --diff-filter=U 2>/dev/null || true)"
  if [ -n "$conflicts" ]; then
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      CONFLICT_ITEMS+=("$file")
    done <<EOF
$conflicts
EOF
  fi
}

run_validation_commands() {
  local repo_dir="$1"
  local runtime_path

  runtime_path="$REQUIRED_CONTROL_REPO/node_modules/.bin:/usr/local/bin:$PATH"

  if (cd "$repo_dir" && PATH="$runtime_path" ./node_modules/.bin/next typegen >/dev/null 2>&1); then
    TYPEGEN_STATUS="OK"
  else
    TYPEGEN_STATUS="KO"
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("next typegen ha fallat a la prova d'integració")
    return 1
  fi

  if (cd "$repo_dir" && PATH="$runtime_path" npm run typecheck >/dev/null); then
    TYPECHECK_STATUS="OK"
  else
    TYPECHECK_STATUS="KO"
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("typecheck ha fallat a la prova d'integració")
    return 1
  fi

  if (cd "$repo_dir" && PATH="$runtime_path" npm run test:node >/dev/null); then
    TEST_NODE_STATUS="OK"
  else
    TEST_NODE_STATUS="KO"
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("test:node ha fallat a la prova d'integració")
    return 1
  fi

  return 0
}

validate_selected_branches() {
  local branch remote_ref

  if [ "$(array_length SELECTED_BRANCHES)" -eq 0 ]; then
    return 0
  fi

  create_validation_worktree

  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    remote_ref="origin/$branch"
    say ""
    say "Validant merge de prova: $branch..."

    if ! git -C "$VALIDATION_WORKTREE" show-ref --verify --quiet "refs/remotes/$remote_ref"; then
      RESULT_STATUS="KO"
      CONFLICT_ITEMS+=("$branch (falta $remote_ref)")
      MERGE_PROBE_STATUS="KO"
      return 1
    fi

    if ! GIT_MERGE_AUTOEDIT=no git -C "$VALIDATION_WORKTREE" merge --no-ff "$remote_ref" >/dev/null 2>&1; then
      MERGE_PROBE_STATUS="KO"
      RESULT_STATUS="KO"
      record_merge_conflicts_from_validation_worktree
      git -C "$VALIDATION_WORKTREE" merge --abort >/dev/null 2>&1 || true
      return 1
    fi
  done < <(array_values SELECTED_BRANCHES)

  MERGE_PROBE_STATUS="OK"
  run_validation_commands "$VALIDATION_WORKTREE"
}

push_validated_head_to_main() {
  local current_origin_main_sha

  if [ "$(array_length SELECTED_BRANCHES)" -eq 0 ]; then
    return 0
  fi

  current_origin_main_sha="$(git -C "$REQUIRED_CONTROL_REPO" rev-parse refs/remotes/origin/main 2>/dev/null || true)"
  if [ -n "$CONTROL_ORIGIN_MAIN_SHA" ] && [ "$current_origin_main_sha" != "$CONTROL_ORIGIN_MAIN_SHA" ]; then
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("origin/main ha canviat mentre es validava. Reintenta integra.")
    return 1
  fi

  say ""
  say "Publicant integració validada a origin/main..."
  if ! git -C "$VALIDATION_WORKTREE" push origin HEAD:refs/heads/main >/dev/null; then
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("No s'ha pogut actualitzar origin/main amb la integració validada")
    return 1
  fi
  ORIGIN_MAIN_STATUS="SI"

  git -C "$REQUIRED_CONTROL_REPO" fetch origin main --quiet
  if ! git -C "$REQUIRED_CONTROL_REPO" checkout main >/dev/null 2>&1; then
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("No s'ha pogut tornar a main al repositori de control")
    return 1
  fi
  if ! git -C "$REQUIRED_CONTROL_REPO" pull --ff-only origin main >/dev/null 2>&1; then
    RESULT_STATUS="KO"
    CONFLICT_ITEMS+=("origin/main s'ha actualitzat però la main local no s'ha pogut sincronitzar")
    return 1
  fi

  MAIN_LOCAL_STATUS="SI"
  INTEGRATED_BRANCHES=()
  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    INTEGRATED_BRANCHES+=("$branch")
  done < <(array_values SELECTED_BRANCHES)
  return 0
}

main() {
  local status_output initial_cwd gate_message

  initial_cwd="$(pwd -P)"

  if [ "$PROJECT_DIR" != "$REQUIRED_CONTROL_REPO" ]; then
    fail_with_message "Aquest script només es pot executar al repo de control: $REQUIRED_CONTROL_REPO"
  fi

  if [ "$initial_cwd" != "$REQUIRED_CONTROL_REPO" ]; then
    fail_with_message "Aquest script només es pot executar des de: $REQUIRED_CONTROL_REPO"
  fi

  cd "$PROJECT_DIR"
  if [ "$(pwd -P)" != "$REQUIRED_CONTROL_REPO" ]; then
    fail_with_message "Aquest script només es pot executar des de: $REQUIRED_CONTROL_REPO"
  fi

  status_output="$(git status --short)"
  if [ -n "$status_output" ]; then
    fail_with_message "Abans d'integrar, main ha d'estar neta. Hi ha canvis locals pendents."
  fi

  git checkout main >/dev/null 2>&1
  git fetch origin --prune --quiet
  git pull --ff-only origin main >/dev/null 2>&1
  CONTROL_ORIGIN_MAIN_SHA="$(git rev-parse refs/remotes/origin/main 2>/dev/null || true)"

  gate_message="$(bash "$PROJECT_DIR/scripts/status.sh" gate integra 2>&1 || true)"
  if [ -n "$gate_message" ]; then
    fail_with_message "$gate_message"
  fi

  discover_ready_branches
  show_ready_branches

  if [ "$(array_length READY_BRANCHES)" -eq 0 ]; then
    print_summary
    exit 0
  fi

  select_branch_to_integrate

  if ! validate_selected_branches; then
    say ""
    say "Bloqueig detectat abans de tocar main. Main es manté intacta."
    print_summary
    exit 1
  fi

  if ! push_validated_head_to_main; then
    print_summary
    exit 1
  fi

  print_summary

  if [ "$RESULT_STATUS" != "OK" ]; then
    exit 1
  fi
}

main "$@"
