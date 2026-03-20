#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ -z "$GIT_COMMON_DIR" ]; then
  echo "No s'ha pogut detectar el repositori git." >&2
  exit 1
fi

CONTROL_REPO_DIR="${WORKFLOW_CONTROL_REPO_DIR:-$(cd "$GIT_COMMON_DIR/.." && pwd)}"
DEFAULT_WORKTREE_ROOT="${WORKTREE_ROOT_DIR:-$(cd "$CONTROL_REPO_DIR/.." && pwd)/summa-social-worktrees}"
TTL_DAYS_DEFAULT=14
MAX_ACTIVE_WORKTREES=12

say() {
  printf '%s\n' "$1"
}

git_control() {
  git -C "$CONTROL_REPO_DIR" "$@"
}

current_repo_dir() {
  pwd -P
}

is_control_repo() {
  [ "$(current_repo_dir)" = "$(cd "$CONTROL_REPO_DIR" && pwd -P)" ]
}

has_changes_in_repo() {
  local repo_dir="$1"
  if [ ! -d "$repo_dir" ]; then
    return 1
  fi
  if [ -n "$(git -C "$repo_dir" status --porcelain --untracked-files=normal 2>/dev/null)" ]; then
    return 0
  fi
  return 1
}

current_branch_in_repo() {
  local repo_dir="$1"
  git -C "$repo_dir" rev-parse --abbrev-ref HEAD
}

ensure_control_main_clean() {
  if ! is_control_repo; then
    say "Aquest pas s'ha d'executar des del repositori de control: $CONTROL_REPO_DIR"
    return 1
  fi

  local branch
  branch="$(current_branch_in_repo "$CONTROL_REPO_DIR")"
  if [ "$branch" != "main" ]; then
    say "El repositori de control ha d'estar a main (ara: $branch)."
    return 1
  fi

  if has_changes_in_repo "$CONTROL_REPO_DIR"; then
    say "El repositori de control ha d'estar net abans d'obrir una tasca nova."
    return 1
  fi

  if ! git_control pull --ff-only origin main >/dev/null; then
    say "No s'ha pogut actualitzar main al repositori de control."
    return 1
  fi

  if has_changes_in_repo "$CONTROL_REPO_DIR"; then
    say "Després de sincronitzar, el repositori de control no ha quedat net."
    return 1
  fi

  return 0
}

build_auto_branch_name() {
  local base candidate counter
  base="codex/work-$(date '+%Y%m%d-%H%M%S')"
  candidate="$base"
  counter=1

  while git_control show-ref --verify --quiet "refs/heads/$candidate"; do
    candidate="${base}-${counter}"
    counter=$((counter + 1))
  done

  printf '%s' "$candidate"
}

sanitize_branch_for_path() {
  printf '%s' "$1" | tr '/[:space:]' '-' | tr -cd '[:alnum:]_.-'
}

build_worktree_path() {
  local branch="$1"
  local sanitized base candidate counter
  sanitized="$(sanitize_branch_for_path "$branch")"
  base="$DEFAULT_WORKTREE_ROOT/$sanitized"
  candidate="$base"
  counter=1

  while [ -e "$candidate" ]; do
    candidate="${base}-${counter}"
    counter=$((counter + 1))
  done

  printf '%s' "$candidate"
}

safe_stat_mtime() {
  local target="$1"
  if stat -f %m "$target" >/dev/null 2>&1; then
    stat -f %m "$target"
    return
  fi
  stat -c %Y "$target"
}

safe_abs_path_if_exists() {
  local target="$1"
  if [ -d "$target" ]; then
    (cd "$target" && pwd -P)
    return
  fi
  printf '%s' "$target"
}

resolve_git_dir_for_repo() {
  local repo_dir="$1"
  local git_dir
  git_dir="$(git -C "$repo_dir" rev-parse --git-dir 2>/dev/null || true)"
  if [ -z "$git_dir" ]; then
    printf '%s' ""
    return
  fi
  if [[ "$git_dir" = /* ]]; then
    printf '%s' "$git_dir"
    return
  fi
  printf '%s' "$repo_dir/$git_dir"
}

last_activity_epoch_for_repo() {
  local repo_dir="$1"
  local latest git_dir git_dir_mtime index_mtime commit_epoch repo_epoch

  if [ ! -d "$repo_dir" ]; then
    printf '%s' 0
    return
  fi

  latest=0
  commit_epoch="$(git -C "$repo_dir" log -1 --format=%ct 2>/dev/null || printf '0')"
  if [ "$commit_epoch" -gt "$latest" ] 2>/dev/null; then
    latest="$commit_epoch"
  fi

  repo_epoch="$(safe_stat_mtime "$repo_dir" 2>/dev/null || printf '0')"
  if [ "$repo_epoch" -gt "$latest" ] 2>/dev/null; then
    latest="$repo_epoch"
  fi

  git_dir="$(resolve_git_dir_for_repo "$repo_dir")"
  if [ -n "$git_dir" ] && [ -e "$git_dir" ]; then
    git_dir_mtime="$(safe_stat_mtime "$git_dir" 2>/dev/null || printf '0')"
    if [ "$git_dir_mtime" -gt "$latest" ] 2>/dev/null; then
      latest="$git_dir_mtime"
    fi

    if [ -e "$git_dir/index" ]; then
      index_mtime="$(safe_stat_mtime "$git_dir/index" 2>/dev/null || printf '0')"
      if [ "$index_mtime" -gt "$latest" ] 2>/dev/null; then
        latest="$index_mtime"
      fi
    fi
  fi

  printf '%s' "$latest"
}

age_days_for_repo() {
  local repo_dir="$1"
  local now latest

  latest="$(last_activity_epoch_for_repo "$repo_dir")"
  if [ "$latest" -le 0 ] 2>/dev/null; then
    printf '%s' "?"
    return
  fi

  now="$(date +%s)"
  if [ "$now" -lt "$latest" ]; then
    printf '%s' 0
    return
  fi

  printf '%s' $(((now - latest) / 86400))
}

is_branch_integrated_to_main() {
  local branch="$1"
  if [ -z "$branch" ]; then
    return 1
  fi
  if ! git_control show-ref --verify --quiet "refs/heads/$branch"; then
    return 1
  fi
  if git_control merge-base --is-ancestor "$branch" main; then
    return 0
  fi
  return 1
}

branch_for_worktree_path() {
  local target_path="$1"
  worktree_records | awk -F '\t' -v p="$target_path" '$1==p { print $2; exit }'
}

worktree_exists() {
  local target_path="$1"
  worktree_records | awk -F '\t' -v p="$target_path" '
    $1==p { found=1 }
    END { exit(found ? 0 : 1) }
  '
}

link_control_env_file() {
  local worktree_path="$1"
  local file_name="$2"
  local control_file="$CONTROL_REPO_DIR/$file_name"
  local worktree_file="$worktree_path/$file_name"

  if [ ! -f "$control_file" ]; then
    return 0
  fi

  if [ -e "$worktree_file" ]; then
    return 0
  fi

  if ln -s "$control_file" "$worktree_file"; then
    say "Enllaç d'entorn creat: $file_name"
    return 0
  fi

  say "Avís: no s'ha pogut enllaçar $file_name al worktree."
  return 0
}

worktree_records() {
  git_control worktree list --porcelain | awk '
    BEGIN { RS=""; FS="\n" }
    {
      wt=""; br="-"; detached="no"; prunable=""
      for (i=1;i<=NF;i++) {
        if ($i ~ /^worktree /) {
          wt=substr($i,10)
        } else if ($i ~ /^branch /) {
          br=substr($i,8)
          sub("refs/heads/", "", br)
        } else if ($i == "detached") {
          detached="yes"
        } else if ($i ~ /^prunable /) {
          prunable=substr($i,10)
        }
      }
      if (wt != "") print wt "\t" br "\t" detached "\t" prunable
    }
  '
}

is_task_branch_name() {
  local branch="$1"
  [[ "$branch" == codex/* ]]
}

unpushed_commit_count_for_repo() {
  local repo_dir="$1"
  local branch="$2"
  local upstream base_ref count

  if [ ! -d "$repo_dir" ]; then
    printf '%s' 0
    return
  fi

  if [ -z "$branch" ] || [ "$branch" = "HEAD" ] || [ "$branch" = "-" ]; then
    printf '%s' 0
    return
  fi

  upstream="$(git -C "$repo_dir" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [ -n "$upstream" ]; then
    base_ref="$upstream"
  elif git_control rev-parse --verify refs/remotes/origin/main >/dev/null 2>&1; then
    base_ref="refs/remotes/origin/main"
  elif git_control rev-parse --verify main >/dev/null 2>&1; then
    base_ref="main"
  else
    printf '%s' 0
    return
  fi

  count="$(git -C "$repo_dir" rev-list --count "$base_ref..HEAD" 2>/dev/null || printf '0')"
  printf '%s' "$count"
}

worktree_local_changes_label() {
  local repo_dir="$1"
  if has_changes_in_repo "$repo_dir"; then
    printf '%s' "SI"
    return
  fi
  printf '%s' "NO"
}

worktree_unpushed_label() {
  local repo_dir="$1"
  local branch="$2"
  local count
  if [ "$branch" = "-" ]; then
    printf '%s' "-"
    return
  fi
  count="$(unpushed_commit_count_for_repo "$repo_dir" "$branch")"
  if [ "$count" -gt 0 ] 2>/dev/null; then
    printf 'SI (%s)' "$count"
    return
  fi
  printf '%s' "NO"
}

recommended_state_for_worktree() {
  local branch="$1"
  local detached="$2"
  local prunable_reason="$3"
  local path_exists_label="$4"
  local local_changes_label="$5"
  local unpushed_count="$6"
  local age_days="$7"

  if [ "$path_exists_label" != "SI" ] || [ -n "$prunable_reason" ] || [ "$detached" = "yes" ]; then
    printf '%s' "REVISAR"
    return
  fi

  if [ "$local_changes_label" = "SI" ] || [ "$unpushed_count" -gt 0 ] 2>/dev/null; then
    printf '%s' "ACTIU"
    return
  fi

  if [ -n "$branch" ] && is_branch_integrated_to_main "$branch"; then
    printf '%s' "TANCAR"
    return
  fi

  if [ "$age_days" != "?" ] && [ "$age_days" -ge "$TTL_DAYS_DEFAULT" ] 2>/dev/null; then
    printf '%s' "REVISAR"
    return
  fi

  printf '%s' "ACTIU"
}

active_worktree_count() {
  local count wt_path wt_branch wt_detached wt_prunable
  count=0

  while IFS=$'\t' read -r wt_path wt_branch wt_detached wt_prunable; do
    local wt_abs
    wt_abs="$(safe_abs_path_if_exists "$wt_path")"

    if [ "$wt_abs" = "$(cd "$CONTROL_REPO_DIR" && pwd -P)" ]; then
      continue
    fi

    if [ ! -d "$wt_path" ]; then
      continue
    fi

    if [ -n "$wt_prunable" ]; then
      continue
    fi

    count=$((count + 1))
  done < <(worktree_records)

  printf '%s' "$count"
}

enforce_active_worktree_limit() {
  local count
  count="$(active_worktree_count)"
  if [ "$count" -lt "$MAX_ACTIVE_WORKTREES" ]; then
    return 0
  fi

  say "BLOCKED_SAFE"
  say "Límit operatiu assolit: $count worktrees actius (màxim $MAX_ACTIVE_WORKTREES)."
  say "Primer cal tancar o netejar worktrees existents amb 'npm run worktree:list', 'npm run worktree:close' o 'npm run worktree:gc'."
  return 1
}

branch_has_registered_worktree_elsewhere() {
  local branch="$1"
  local skip_path="$2"
  local wt_path wt_branch wt_detached wt_prunable

  while IFS=$'\t' read -r wt_path wt_branch wt_detached wt_prunable; do
    if [ "$wt_branch" != "$branch" ]; then
      continue
    fi
    if [ "$wt_path" = "$skip_path" ]; then
      continue
    fi
    return 0
  done < <(worktree_records)

  return 1
}

print_worktree_detail() {
  local wt_path="$1"
  local wt_branch="$2"
  local wt_detached="$3"
  local wt_prunable="$4"
  local display_branch repo_dir local_changes age_days unpushed_count unpushed_label path_exists_label state

  repo_dir="$(safe_abs_path_if_exists "$wt_path")"
  if [ "$wt_detached" = "yes" ]; then
    display_branch="DETACHED"
  elif [ -n "$wt_branch" ] && [ "$wt_branch" != "-" ]; then
    display_branch="$wt_branch"
  else
    display_branch="-"
  fi

  if [ -d "$wt_path" ]; then
    path_exists_label="SI"
    local_changes="$(worktree_local_changes_label "$repo_dir")"
    age_days="$(age_days_for_repo "$repo_dir")"
    unpushed_count="$(unpushed_commit_count_for_repo "$repo_dir" "$wt_branch")"
  else
    path_exists_label="NO"
    local_changes="-"
    age_days="?"
    unpushed_count=0
  fi

  unpushed_label="$(worktree_unpushed_label "$repo_dir" "$wt_branch")"
  state="$(recommended_state_for_worktree "$wt_branch" "$wt_detached" "$wt_prunable" "$path_exists_label" "$local_changes" "$unpushed_count" "$age_days")"

  say "WORKTREE"
  say "- path: $wt_path"
  say "- branca: $display_branch"
  say "- canvis locals: $local_changes"
  say "- commits no pujats: $unpushed_label"
  say "- antiguitat aproximada: ${age_days}d"
  say "- estat recomanat: $state"
  if [ -n "$wt_prunable" ]; then
    say "- observació: prunable ($wt_prunable)"
  elif [ "$path_exists_label" = "NO" ]; then
    say "- observació: ruta inexistent"
  fi
  say ""
}

create_cmd() {
  local branch=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --branch)
        branch="${2:-}"
        shift 2
        ;;
      *)
        say "Paràmetre desconegut: $1"
        return 1
        ;;
    esac
  done

  ensure_control_main_clean || return 1
  enforce_active_worktree_limit || return 1

  if [ -z "$branch" ]; then
    branch="$(build_auto_branch_name)"
  fi

  if ! is_task_branch_name "$branch"; then
    say "La branca de tasca ha de començar per codex/"
    return 1
  fi

  if git_control show-ref --verify --quiet "refs/heads/$branch"; then
    say "La branca ja existeix: $branch"
    return 1
  fi

  mkdir -p "$DEFAULT_WORKTREE_ROOT"

  local worktree_path
  worktree_path="$(build_worktree_path "$branch")"

  git_control worktree add -b "$branch" "$worktree_path" main >/dev/null
  link_control_env_file "$worktree_path" ".env.local"
  link_control_env_file "$worktree_path" ".env.demo"

  say "Branca de tasca creada: $branch"
  say "Worktree creat: $worktree_path"
  say "Treballa dins del worktree per implementar aquesta tasca."
}

list_cmd() {
  local active_count
  active_count="$(active_worktree_count)"

  say "CONTROL: $(cd "$CONTROL_REPO_DIR" && pwd -P)"
  say "ROOT TASQUES: $DEFAULT_WORKTREE_ROOT"
  say "WORKTREES ACTIUS: $active_count/$MAX_ACTIVE_WORKTREES"
  say ""

  local wt_path wt_branch wt_detached wt_prunable
  while IFS=$'\t' read -r wt_path wt_branch wt_detached wt_prunable; do
    print_worktree_detail "$wt_path" "$wt_branch" "$wt_detached" "$wt_prunable"
  done < <(worktree_records)
}

close_cmd() {
  local confirm_discard=false
  local target=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --confirm-discard)
        confirm_discard=true
        shift
        ;;
      *)
        if [ -n "$target" ]; then
          say "Només es permet un objectiu per tancar."
          return 1
        fi
        target="$1"
        shift
        ;;
    esac
  done

  local requested_path target_path target_branch target_detached target_prunable
  local current_abs control_abs

  current_abs="$(current_repo_dir)"
  control_abs="$(cd "$CONTROL_REPO_DIR" && pwd -P)"

  if [ -z "$target" ]; then
    if is_control_repo; then
      say "Indica una branca o ruta de worktree per tancar."
      return 1
    fi
    requested_path="$current_abs"
  elif [ -d "$target" ]; then
    requested_path="$(cd "$target" && pwd -P)"
  elif [ -d "$PROJECT_DIR/$target" ]; then
    requested_path="$(cd "$PROJECT_DIR/$target" && pwd -P)"
  else
    requested_path="$target"
  fi

  target_path=""
  target_branch=""
  target_detached="no"
  target_prunable=""

  local wt_path wt_branch wt_detached wt_prunable
  while IFS=$'\t' read -r wt_path wt_branch wt_detached wt_prunable; do
    local wt_abs
    wt_abs="$(safe_abs_path_if_exists "$wt_path")"

    if [ "$requested_path" = "$wt_path" ] || [ "$requested_path" = "$wt_abs" ] || [ "$requested_path" = "$wt_branch" ]; then
      target_path="$wt_path"
      target_branch="$wt_branch"
      target_detached="$wt_detached"
      target_prunable="$wt_prunable"
      break
    fi
  done < <(worktree_records)

  if [ -z "$target_path" ]; then
    say "No s'ha trobat cap worktree per: $requested_path"
    return 1
  fi

  if [ "$target_path" = "$control_abs" ]; then
    say "No es pot tancar el worktree de control."
    return 1
  fi

  if [ "$target_detached" = "yes" ]; then
    say "No es pot tancar automàticament un worktree detached. Cal revisar-lo manualment."
    return 1
  fi

  if [ -z "$target_branch" ]; then
    say "No s'ha pogut determinar la branca del worktree: $target_path"
    return 1
  fi

  if [ -d "$target_path" ] && has_changes_in_repo "$target_path"; then
    say "No es pot tancar: hi ha canvis locals no commitjats a $target_path"
    return 1
  fi

  local repo_dir unpushed_count integrated_to_main
  repo_dir="$(safe_abs_path_if_exists "$target_path")"
  unpushed_count="$(unpushed_commit_count_for_repo "$repo_dir" "$target_branch")"
  if [ "$unpushed_count" -gt 0 ] 2>/dev/null; then
    say "No es pot tancar: la branca $target_branch té $unpushed_count commits no pujats."
    return 1
  fi

  integrated_to_main=false
  if is_branch_integrated_to_main "$target_branch"; then
    integrated_to_main=true
  fi

  if [ -n "$target_prunable" ] || [ ! -d "$target_path" ]; then
    if [ "$confirm_discard" != "true" ]; then
      say "Aquest worktree és orfe o prunable. Revisa'l i repeteix amb --confirm-discard si el vols descartar."
      return 1
    fi

    git_control worktree prune --expire now >/dev/null 2>&1 || true
    say "Registre prunable descartat: $target_path"
    if [ "$integrated_to_main" = true ] && ! branch_has_registered_worktree_elsewhere "$target_branch" "$target_path"; then
      git_control branch -d "$target_branch" >/dev/null 2>&1 || true
    fi
    return 0
  fi

  if [ "$integrated_to_main" != true ] && [ "$confirm_discard" != "true" ]; then
    say "La branca $target_branch no està integrada a main."
    say "Si vols descartar només el worktree però conservar la branca, repeteix amb --confirm-discard."
    return 1
  fi

  git_control worktree remove "$target_path"

  if [ "$integrated_to_main" = true ] && ! branch_has_registered_worktree_elsewhere "$target_branch" "$target_path"; then
    git_control branch -d "$target_branch" >/dev/null 2>&1 || true
  fi

  say "Worktree tancat: $target_path"
  if [ "$integrated_to_main" = true ]; then
    say "Branca integrada i tancada: $target_branch"
  else
    say "Worktree descartat amb confirmació explícita. Branca conservada: $target_branch"
  fi
}

gc_cmd() {
  local ttl_days="$TTL_DAYS_DEFAULT"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --ttl-days)
        ttl_days="${2:-}"
        shift 2
        ;;
      *)
        say "Paràmetre desconegut: $1"
        return 1
        ;;
    esac
  done

  if ! [[ "$ttl_days" =~ ^[0-9]+$ ]]; then
    say "ttl-days ha de ser un enter positiu."
    return 1
  fi

  local safe_items review_items safe_count review_count
  local control_abs wt_path wt_branch wt_detached wt_prunable
  safe_items=""
  review_items=""
  safe_count=0
  review_count=0
  control_abs="$(cd "$CONTROL_REPO_DIR" && pwd -P)"

  while IFS=$'\t' read -r wt_path wt_branch wt_detached wt_prunable; do
    local wt_abs local_changes_label age_days unpushed_count reason
    wt_abs="$(safe_abs_path_if_exists "$wt_path")"

    if [ "$wt_abs" = "$control_abs" ]; then
      continue
    fi

    if [ -n "$wt_prunable" ] || [ ! -d "$wt_path" ]; then
      safe_items="${safe_items}- worktree orfe/prunable: $wt_path\n"
      safe_count=$((safe_count + 1))
      continue
    fi

    if [ "$wt_detached" = "yes" ]; then
      review_items="${review_items}- worktree detached: $wt_path\n"
      review_count=$((review_count + 1))
      continue
    fi

    local_changes_label="$(worktree_local_changes_label "$wt_abs")"
    age_days="$(age_days_for_repo "$wt_abs")"
    unpushed_count="$(unpushed_commit_count_for_repo "$wt_abs" "$wt_branch")"

    if [ -n "$wt_branch" ] && is_branch_integrated_to_main "$wt_branch" && [ "$local_changes_label" = "NO" ] && [ "$unpushed_count" -eq 0 ] 2>/dev/null; then
      safe_items="${safe_items}- worktree net i integrat: $wt_path ($wt_branch)\n"
      safe_count=$((safe_count + 1))
      continue
    fi

    reason=""
    if [ "$local_changes_label" = "SI" ]; then
      reason="té canvis locals"
    elif [ "$unpushed_count" -gt 0 ] 2>/dev/null; then
      reason="té commits no pujats"
    elif [ "$age_days" != "?" ] && [ "$age_days" -ge "$ttl_days" ] 2>/dev/null; then
      reason="és antic (${age_days}d)"
    else
      reason="encara actiu"
    fi

    review_items="${review_items}- revisar: $wt_path ($wt_branch, $reason)\n"
    review_count=$((review_count + 1))
  done < <(worktree_records)

  while IFS= read -r branch; do
    [ -z "$branch" ] && continue

    if ! is_branch_integrated_to_main "$branch"; then
      continue
    fi

    if branch_has_registered_worktree_elsewhere "$branch" ""; then
      continue
    fi

    safe_items="${safe_items}- branca codex fusionada sense worktree: $branch\n"
    safe_count=$((safe_count + 1))
  done < <(git_control for-each-ref --format='%(refname:short)' refs/heads/codex)

  say "RESUM GC WORKTREES"
  say "- TTL de revisió: ${ttl_days} dies"
  say ""
  say "ELIMINABLE SEGUR"
  if [ "$safe_count" -eq 0 ]; then
    say "- cap"
  else
    printf '%b' "$safe_items"
  fi
  say ""
  say "REVISIÓ MANUAL"
  if [ "$review_count" -eq 0 ]; then
    say "- cap"
  else
    printf '%b' "$review_items"
  fi
}

usage() {
  say "Us: bash scripts/worktree.sh [create|list|close|gc]"
  say "  create [--branch codex/xxx]"
  say "  list"
  say "  close [--confirm-discard] [<branch|path>]"
  say "  gc [--ttl-days 14]"
}

main() {
  local cmd="${1:-}"
  shift || true

  case "$cmd" in
    create)
      create_cmd "$@"
      ;;
    list)
      list_cmd
      ;;
    close)
      close_cmd "$@"
      ;;
    gc)
      gc_cmd "$@"
      ;;
    *)
      usage
      return 1
      ;;
  esac
}

main "$@"
