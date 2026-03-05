#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

required_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
}

extract_repo_slug() {
  local url="$1"
  local slug=""

  if [[ "$url" =~ ^git@[^:]+:(.+)$ ]]; then
    slug="${BASH_REMATCH[1]}"
  elif [[ "$url" =~ ^ssh://git@[^/]+/(.+)$ ]]; then
    slug="${BASH_REMATCH[1]}"
  elif [[ "$url" =~ ^https://[^/]+/(.+)$ ]]; then
    slug="${BASH_REMATCH[1]}"
  fi

  slug="${slug%.git}"
  echo "$slug"
}

extract_repo_host() {
  local url="$1"

  if [[ "$url" =~ ^git@([^:]+): ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  if [[ "$url" =~ ^ssh://git@([^/]+)/ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  if [[ "$url" =~ ^https://([^/]+)/ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  echo "github.com"
}

required_env SOURCE_REPO_SSH
required_env SOURCE_SSH_KEY
required_env GITHUB_REPOSITORY

PUSH_TOKEN="${TARGET_PUSH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$PUSH_TOKEN" ]]; then
  echo "Missing required environment variable: TARGET_PUSH_TOKEN (or legacy GITHUB_TOKEN)" >&2
  exit 1
fi

SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
TARGET_BRANCH="${TARGET_BRANCH:-mirror/prod}"
ALLOW_TARGET_MAIN="${ALLOW_TARGET_MAIN:-false}"

if [[ "$TARGET_BRANCH" == "main" && "$ALLOW_TARGET_MAIN" != "true" ]]; then
  echo "Refusing to sync to main. Set TARGET_BRANCH to mirror/prod (or set ALLOW_TARGET_MAIN=true explicitly)." >&2
  exit 1
fi

SOURCE_SLUG="$(extract_repo_slug "$SOURCE_REPO_SSH")"
if [[ -n "$SOURCE_SLUG" && "$SOURCE_SLUG" == "$GITHUB_REPOSITORY" ]]; then
  echo "Refusing to mirror repository into itself: $GITHUB_REPOSITORY" >&2
  exit 1
fi

SOURCE_HOST="$(extract_repo_host "$SOURCE_REPO_SSH")"
SSH_KEY_FILE="$WORK_DIR/source_key"
KNOWN_HOSTS_FILE="$WORK_DIR/known_hosts"

printf '%s\n' "$SOURCE_SSH_KEY" > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"
ssh-keyscan -t rsa,ecdsa,ed25519 "$SOURCE_HOST" > "$KNOWN_HOSTS_FILE" 2>/dev/null

export GIT_SSH_COMMAND="ssh -i $SSH_KEY_FILE -o IdentitiesOnly=yes -o UserKnownHostsFile=$KNOWN_HOSTS_FILE -o StrictHostKeyChecking=yes -o LogLevel=ERROR"

git init --quiet "$WORK_DIR/repo"
cd "$WORK_DIR/repo"

git remote add source "$SOURCE_REPO_SSH"
git fetch --prune --no-tags source "$SOURCE_BRANCH"
git checkout --quiet -B "$TARGET_BRANCH" FETCH_HEAD

git config user.name "prod-mirror-bot"
git config user.email "prod-mirror-bot@users.noreply.github.com"

DESTINATION_URL="https://x-access-token:${PUSH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
git push --force "$DESTINATION_URL" "HEAD:${TARGET_BRANCH}"

echo "Mirror sync completed: ${SOURCE_REPO_SSH}#${SOURCE_BRANCH} -> ${GITHUB_REPOSITORY}#${TARGET_BRANCH}"
