#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/change-profile.sh"

cd "$PROJECT_DIR"

GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ -z "$GIT_COMMON_DIR" ]; then
  echo "No s'ha pogut detectar el repositori git." >&2
  exit 1
fi

CONTROL_REPO_DIR="${WORKFLOW_CONTROL_REPO_DIR:-$(cd "$GIT_COMMON_DIR/.." && pwd)}"
PUBLICA_TARGET_BRANCH="${DEPLOY_TARGET_BRANCH:-main}"

say() {
  printf '%s\n' "$1"
}

collect_scope_files() {
  local files=""
  local branch=""
  local merge_base=""

  files=$(
    (
      git diff --name-only
      git diff --cached --name-only
      git ls-files --others --exclude-standard
    ) | awk 'NF' | sort -u
  )

  if [ -n "$files" ]; then
    printf '%s' "$files"
    return
  fi

  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf '%s' "")"
  if [ "$branch" = "main" ] && git rev-parse prod >/dev/null 2>&1; then
    git diff --name-only "prod..$branch" --diff-filter=ACMRT | awk 'NF' | sort -u
    return
  fi

  if [ "$branch" != "HEAD" ] && [ "$branch" != "main" ] && [ "$branch" != "prod" ] \
    && git rev-parse main >/dev/null 2>&1; then
    merge_base="$(git merge-base HEAD main 2>/dev/null || true)"
    if [ -n "$merge_base" ]; then
      git diff --name-only "$merge_base..HEAD" --diff-filter=ACMRT | awk 'NF' | sort -u
      return
    fi
  fi
}

load_worktree_report() {
  eval "$(bash "$SCRIPT_DIR/worktree.sh" report --format shell)"
}

current_control_branch() {
  git -C "$CONTROL_REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '%s' "-"
}

control_repo_clean_label() {
  if [ -n "$(git -C "$CONTROL_REPO_DIR" status --short 2>/dev/null || true)" ]; then
    printf '%s' "NO"
    return
  fi
  printf '%s' "SI"
}

main_aligned_label() {
  local local_main remote_main
  local_main="$(git -C "$CONTROL_REPO_DIR" rev-parse refs/heads/main 2>/dev/null || true)"
  remote_main="$(git -C "$CONTROL_REPO_DIR" rev-parse refs/remotes/origin/main 2>/dev/null || true)"
  if [ -n "$local_main" ] && [ -n "$remote_main" ] && [ "$local_main" = "$remote_main" ]; then
    printf '%s' "SI"
    return
  fi
  printf '%s' "NO"
}

target_aligned_label() {
  local target_branch="$1"
  local local_target remote_target
  local_target="$(git -C "$CONTROL_REPO_DIR" rev-parse "refs/heads/$target_branch" 2>/dev/null || true)"
  remote_target="$(git -C "$CONTROL_REPO_DIR" rev-parse "refs/remotes/origin/$target_branch" 2>/dev/null || true)"
  if [ -n "$local_target" ] && [ -n "$remote_target" ] && [ "$local_target" = "$remote_target" ]; then
    printf '%s' "SI"
    return
  fi
  printf '%s' "NO"
}

prod_aligned_with_main_label() {
  local local_main remote_prod
  local_main="$(git -C "$CONTROL_REPO_DIR" rev-parse refs/heads/main 2>/dev/null || true)"
  remote_prod="$(git -C "$CONTROL_REPO_DIR" rev-parse refs/remotes/origin/prod 2>/dev/null || true)"
  if [ -n "$local_main" ] && [ -n "$remote_prod" ] && [ "$local_main" = "$remote_prod" ]; then
    printf '%s' "SI"
    return
  fi
  printf '%s' "NO"
}

prod_ahead_of_main_label() {
  if git -C "$CONTROL_REPO_DIR" rev-parse refs/remotes/origin/prod >/dev/null 2>&1 \
    && git -C "$CONTROL_REPO_DIR" rev-parse refs/heads/main >/dev/null 2>&1 \
    && ! git -C "$CONTROL_REPO_DIR" merge-base --is-ancestor refs/remotes/origin/prod refs/heads/main >/dev/null 2>&1; then
    printf '%s' "SI"
    return
  fi
  printf '%s' "NO"
}

prod_ahead_of_target_label() {
  local target_branch="$1"
  if git -C "$CONTROL_REPO_DIR" rev-parse refs/remotes/origin/prod >/dev/null 2>&1 \
    && git -C "$CONTROL_REPO_DIR" rev-parse "refs/heads/$target_branch" >/dev/null 2>&1 \
    && ! git -C "$CONTROL_REPO_DIR" merge-base --is-ancestor refs/remotes/origin/prod "refs/heads/$target_branch" >/dev/null 2>&1; then
    printf '%s' "SI"
    return
  fi
  printf '%s' "NO"
}

work_clean_label() {
  if [ "${WORKTREE_ACTIVE_COUNT:-0}" -gt 1 ] 2>/dev/null; then
    printf '%s' "NO"
    return
  fi
  if [ "${WORKTREE_DIRTY_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    printf '%s' "NO"
    return
  fi
  if [ "${WORKTREE_UNPUSHED_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    printf '%s' "NO"
    return
  fi
  printf '%s' "SI"
}

join_reasons() {
  local first=true
  local item
  for item in "$@"; do
    [ -z "$item" ] && continue
    if [ "$first" = true ]; then
      printf '%s' "$item"
      first=false
    else
      printf '\n- %s' "$item"
    fi
  done
}

print_status() {
  local branch work_clean main_aligned prod_aligned global_status
  local control_branch control_clean prod_ahead
  local -a reasons=()
  local scope_files scope scope_risk deploy_mode scope_eval

  git -C "$CONTROL_REPO_DIR" fetch origin --prune --quiet >/dev/null 2>&1 || true
  load_worktree_report
  scope_files="$(collect_scope_files)"
  scope="EDGE"
  scope_risk="BAIX"
  deploy_mode="RAPID"

  if [ -n "$scope_files" ]; then
    scope_eval="$(summa_scope_eval "$scope_files")"
    eval "$scope_eval"
    scope="$(printf '%s' "$SCOPE" | tr '[:lower:]' '[:upper:]')"
    scope_risk="$RISK"
    deploy_mode="$DEPLOY_MODE"
  fi

  control_branch="$(current_control_branch)"
  control_clean="$(control_repo_clean_label)"
  main_aligned="$(main_aligned_label)"
  prod_aligned="$(prod_aligned_with_main_label)"
  prod_ahead="$(prod_ahead_of_main_label)"
  branch="${WORKTREE_ACTIVE_BRANCH:-"-"}"
  work_clean="$(work_clean_label)"

  if [ "$control_branch" != "main" ]; then
    reasons+=("el repositori de control no està a main")
  fi
  if [ "$control_clean" != "SI" ]; then
    reasons+=("main té canvis locals pendents")
  fi
  if [ "$main_aligned" != "SI" ]; then
    reasons+=("main no està alineada amb origin/main")
  fi
  if [ "${WORKTREE_ACTIVE_CODEX_COUNT:-0}" -gt 1 ] 2>/dev/null; then
    reasons+=("hi ha més d'un worktree codex actiu")
  fi
  if [ "${WORKTREE_ACTIVE_HOTFIX_COUNT:-0}" -gt 1 ] 2>/dev/null; then
    reasons+=("hi ha més d'un worktree hotfix actiu")
  fi
  if [ "${WORKTREE_ACTIVE_COUNT:-0}" -gt 2 ] 2>/dev/null; then
    reasons+=("hi ha més de 2 worktrees de tasca actius")
  fi
  if [ "${WORKTREE_RESIDUE_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    reasons+=("hi ha worktrees residuals o ambigus oberts")
  fi
  if [ "$prod_ahead" = "SI" ]; then
    reasons+=("prod conté commits fora de main")
  fi

  if [ "${#reasons[@]}" -eq 0 ]; then
    global_status="OK"
  else
    global_status="BLOQUEJAT"
  fi

  say "------------------------"
  say "SCOPE: $scope"
  say "RISC: $scope_risk"
  say "DEPLOY MODE: $deploy_mode"
  say "------------------------"
  say ""
  say "WORK:"
  say "- branch activa: $branch"
  say "- clean: $work_clean"
  say ""
  say "MAIN:"
  say "- alineada amb origin: $main_aligned"
  say ""
  say "PROD:"
  say "- alineada amb main: $prod_aligned"
  say ""
  say "WORKTREES:"
  say "- actius: ${WORKTREE_ACTIVE_COUNT:-0}"
  say "- residus: ${WORKTREE_RESIDUE_COUNT:-0}"
  say ""
  say "ESTAT GLOBAL:"
  say "- $global_status"

  if [ "${#reasons[@]}" -gt 0 ]; then
    say ""
    say "BLOQUEJOS:"
    say "- $(join_reasons "${reasons[@]}")"
  fi
}

gate_integra() {
  local control_branch control_clean main_aligned

  bash "$SCRIPT_DIR/worktree.sh" gc --quiet >/dev/null 2>&1 || true
  git -C "$CONTROL_REPO_DIR" fetch origin --prune --quiet >/dev/null 2>&1 || true
  load_worktree_report

  control_branch="$(current_control_branch)"
  control_clean="$(control_repo_clean_label)"
  main_aligned="$(main_aligned_label)"

  if [ "$control_branch" != "main" ]; then
    say "Abans d'integrar, el repositori de control ha d'estar a main."
    return 1
  fi
  if [ "$control_clean" != "SI" ]; then
    say "Abans d'integrar, main ha d'estar neta."
    return 1
  fi
  if [ "$main_aligned" != "SI" ]; then
    say "Abans d'integrar, main ha d'estar alineada amb origin/main."
    return 1
  fi
  if [ "${WORKTREE_RESIDUE_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    say "Abans d'integrar, cal resoldre els worktrees residuals o ambigus."
    return 1
  fi
  if [ "${WORKTREE_DIRTY_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    say "Abans d'integrar, no pot quedar cap worktree amb canvis locals."
    return 1
  fi
  if [ "${WORKTREE_UNPUSHED_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    say "Abans d'integrar, no pot quedar cap worktree amb commits no pujats."
    return 1
  fi
  if [ "${WORKTREE_READY_COUNT:-0}" -eq 0 ] 2>/dev/null; then
    say "No hi ha cap branca de worktree llesta per integrar."
    return 1
  fi
  if [ "${WORKTREE_READY_COUNT:-0}" -gt 1 ] 2>/dev/null; then
    say "Hi ha més d'una branca llesta per integrar. Redueix-ho a una sola veritat de treball."
    return 1
  fi

  return 0
}

gate_publica() {
  local control_branch control_clean target_aligned prod_ahead

  bash "$SCRIPT_DIR/worktree.sh" gc --quiet >/dev/null 2>&1 || true
  git -C "$CONTROL_REPO_DIR" fetch origin --prune --quiet >/dev/null 2>&1 || true
  load_worktree_report

  control_branch="$(current_control_branch)"
  control_clean="$(control_repo_clean_label)"
  target_aligned="$(target_aligned_label "$PUBLICA_TARGET_BRANCH")"
  prod_ahead="$(prod_ahead_of_target_label "$PUBLICA_TARGET_BRANCH")"

  if [ "$control_branch" != "$PUBLICA_TARGET_BRANCH" ]; then
    say "Abans de publicar, el repositori de control ha d'estar a $PUBLICA_TARGET_BRANCH."
    return 1
  fi
  if [ "$control_clean" != "SI" ]; then
    say "Abans de publicar, $PUBLICA_TARGET_BRANCH ha d'estar neta."
    return 1
  fi
  if [ "$target_aligned" != "SI" ]; then
    say "Abans de publicar, $PUBLICA_TARGET_BRANCH ha d'estar alineada amb origin/$PUBLICA_TARGET_BRANCH."
    return 1
  fi
  if [ "$prod_ahead" = "SI" ]; then
    say "Abans de publicar, prod no pot contenir commits fora de $PUBLICA_TARGET_BRANCH."
    return 1
  fi
  if [ "${WORKTREE_RESIDUE_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    say "Abans de publicar, cal resoldre els worktrees residuals o ambigus."
    return 1
  fi
  if [ "${WORKTREE_ACTIVE_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    say "Abans de publicar, no pot quedar cap worktree de tasca actiu."
    return 1
  fi

  return 0
}

main() {
  local cmd="${1:-print}"
  case "$cmd" in
    print|status|"")
      print_status
      ;;
    gate)
      case "${2:-}" in
        integra)
          gate_integra
          ;;
        publica)
          gate_publica
          ;;
        *)
          say "Ús: bash scripts/status.sh gate [integra|publica]"
          return 1
          ;;
      esac
      ;;
    *)
      say "Ús: bash scripts/status.sh [print|gate integra|gate publica]"
      return 1
      ;;
  esac
}

main "$@"
