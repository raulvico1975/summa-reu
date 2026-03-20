#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUIRED_CONTROL_REPO="/Users/raulvico/Documents/summa-social"

RESULT_STATUS="OK"
TYPECHECK_STATUS="KO"
TEST_NODE_STATUS="KO"
MAIN_UPDATED="NO"
INTEGRATED_BRANCHES=()
CONFLICT_ITEMS=()
PENDING_BRANCHES=()
SELECTED_BRANCHES=()

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

print_summary() {
  local pending_count integrated_count
  pending_count="$(count_remaining_pending_branches)"
  integrated_count="${#INTEGRATED_BRANCHES[@]}"

  say ""
  say "RESULTAT: INTEGRACIÓ $RESULT_STATUS"
  say ""
  say "BRANQUES INTEGRADES"
  if [ "${#INTEGRATED_BRANCHES[@]}" -eq 0 ]; then
    say "- cap"
  else
    print_list_or_empty "${INTEGRATED_BRANCHES[@]}"
  fi
  say ""
  say "CONFLICTES"
  if [ "${#CONFLICT_ITEMS[@]}" -eq 0 ]; then
    say "- cap"
  else
    print_list_or_empty "${CONFLICT_ITEMS[@]}"
  fi
  say ""
  say "VALIDACIONS"
  say "- typecheck: $TYPECHECK_STATUS"
  say "- test:node: $TEST_NODE_STATUS"
  say ""
  say "ESTAT FINAL"
  say "- main actualitzada: $MAIN_UPDATED"
  say "- branques integrades: $integrated_count"
  say "- pendent d'integrar: $pending_count"
  say ""
  say "RECOMANACIÓ"
  say "- si aquest bloc és coherent -> pots fer deploy"
  say "- si no -> continuar integrant en blocs"
}

fail_with_message() {
  local message="$1"
  RESULT_STATUS="KO"
  say "$message"
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

  for branch in "${PENDING_BRANCHES[@]}"; do
    if array_contains "$branch" "${INTEGRATED_BRANCHES[@]}"; then
      continue
    fi
    remaining_count=$((remaining_count + 1))
  done

  printf '%s' "$remaining_count"
}

discover_pending_branches() {
  local raw branch remote_ref

  while IFS= read -r raw; do
    branch="$(trim_branch_line "$raw")"
    [ -z "$branch" ] && continue

    remote_ref="origin/$branch"
    if ! git show-ref --verify --quiet "refs/remotes/$remote_ref"; then
      continue
    fi

    if git merge-base --is-ancestor "$remote_ref" main >/dev/null 2>&1; then
      continue
    fi

    PENDING_BRANCHES+=("$branch")
  done < <(git branch --list "codex/*")
}

show_pending_branches() {
  local branch description index

  say "BRANQUES DISPONIBLES"
  if [ "${#PENDING_BRANCHES[@]}" -eq 0 ]; then
    say "- cap"
    return
  fi

  index=1
  for branch in "${PENDING_BRANCHES[@]}"; do
    description="$(branch_description "$branch")"
    say "- [$index] $branch -> $description"
    index=$((index + 1))
  done

  say ""
  say "RECOMANACIÓ"
  say "- pots integrar totes o seleccionar un subconjunt coherent"
  say "- evita barrejar canvis no relacionats"

  if [ "${#PENDING_BRANCHES[@]}" -gt 3 ]; then
    say ""
    say "AVÍS"
    say "Estàs integrant moltes branques alhora."
    say "Recomanat: integrar en blocs petits i coherents."
  fi
}

select_branches_to_integrate() {
  local selection trimmed branch index token normalized_tokens selected_branch

  if [ "${#PENDING_BRANCHES[@]}" -eq 0 ]; then
    return 0
  fi

  say ""
  say "SELECCIÓ"
  say "- mode selectiu (per defecte): escriu un o més números o noms de branca separats per espais o comes"
  say "- mode totes: escriu exactament 'all'"
  printf '> '
  IFS= read -r selection || selection=""
  trimmed="$(printf '%s' "$selection" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"

  if [ -z "$trimmed" ]; then
    fail_with_message "Integració cancel·lada: no s'ha seleccionat cap branca."
  fi

  if [ "$trimmed" = "all" ]; then
    SELECTED_BRANCHES=("${PENDING_BRANCHES[@]}")
    return 0
  fi

  normalized_tokens="$(printf '%s' "$trimmed" | tr ',' ' ')"
  for token in $normalized_tokens; do
    [ -z "$token" ] && continue
    selected_branch=""

    if [[ "$token" =~ ^[0-9]+$ ]]; then
      index=$((token - 1))
      if [ "$index" -lt 0 ] || [ "$index" -ge "${#PENDING_BRANCHES[@]}" ]; then
        fail_with_message "Selecció no vàlida: $token"
      fi
      selected_branch="${PENDING_BRANCHES[$index]}"
    else
      for branch in "${PENDING_BRANCHES[@]}"; do
        if [ "$branch" = "$token" ]; then
          selected_branch="$branch"
          break
        fi
      done
      if [ -z "$selected_branch" ]; then
        fail_with_message "Selecció no vàlida: $token"
      fi
    fi

    if [ "${#SELECTED_BRANCHES[@]}" -eq 0 ] || ! array_contains "$selected_branch" "${SELECTED_BRANCHES[@]}"; then
      SELECTED_BRANCHES+=("$selected_branch")
    fi
  done

  if [ "${#SELECTED_BRANCHES[@]}" -eq 0 ]; then
    fail_with_message "Integració cancel·lada: no s'ha seleccionat cap branca."
  fi
}

merge_selected_branches() {
  local branch remote_ref conflicts

  for branch in "${SELECTED_BRANCHES[@]}"; do
    remote_ref="origin/$branch"
    say ""
    say "Integrant $branch..."

    if ! git show-ref --verify --quiet "refs/remotes/$remote_ref"; then
      CONFLICT_ITEMS+=("$branch (falta $remote_ref)")
      RESULT_STATUS="KO"
      return 1
    fi

    if ! GIT_MERGE_AUTOEDIT=no git merge --no-ff "$remote_ref"; then
      conflicts="$(git diff --name-only --diff-filter=U)"
      if [ -n "$conflicts" ]; then
        while IFS= read -r file; do
          [ -z "$file" ] && continue
          CONFLICT_ITEMS+=("$file")
        done <<EOF
$conflicts
EOF
      else
        CONFLICT_ITEMS+=("$branch")
      fi
      RESULT_STATUS="KO"
      return 1
    fi

    INTEGRATED_BRANCHES+=("$branch")
    MAIN_UPDATED="SI"
  done

  return 0
}

run_post_integrations_validations() {
  if PATH=/usr/local/bin:$PATH npm run typecheck; then
    TYPECHECK_STATUS="OK"
  else
    TYPECHECK_STATUS="KO"
    RESULT_STATUS="KO"
  fi

  if PATH=/usr/local/bin:$PATH npm run test:node; then
    TEST_NODE_STATUS="OK"
  else
    TEST_NODE_STATUS="KO"
    RESULT_STATUS="KO"
  fi

  return 0
}

main() {
  local status_output initial_cwd

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
    fail_with_message "Abans d'integrar, main ha d'estar net. Hi ha canvis locals pendents."
  fi

  git checkout main
  git pull --ff-only

  discover_pending_branches
  show_pending_branches
  select_branches_to_integrate

  if ! merge_selected_branches; then
    say ""
    say "Conflicte detectat. Resol-lo manualment abans de continuar."
    print_summary
    exit 1
  fi

  run_post_integrations_validations
  print_summary

  if [ "$RESULT_STATUS" != "OK" ]; then
    exit 1
  fi
}

main "$@"
