#!/usr/bin/env bash
set -euo pipefail

required_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

required_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
}

required_cmd gh

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

required_env PROD_SOURCE_REPO_SSH
required_env PROD_SOURCE_READONLY_SSH_KEY
required_env PROD_MIRROR_PUSH_TOKEN

TARGET_REPO="${TARGET_REPO:-}"
if [[ -z "$TARGET_REPO" ]]; then
  TARGET_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

PROD_SOURCE_BRANCH="${PROD_SOURCE_BRANCH:-main}"
PROD_MIRROR_TARGET_BRANCH="${PROD_MIRROR_TARGET_BRANCH:-mirror/prod}"
MIRROR_NOTIFY_SUCCESS="${MIRROR_NOTIFY_SUCCESS:-false}"

echo "Configuring mirror secrets/variables in ${TARGET_REPO}..."

gh secret set PROD_SOURCE_REPO_SSH --repo "$TARGET_REPO" --body "$PROD_SOURCE_REPO_SSH"
gh secret set PROD_SOURCE_READONLY_SSH_KEY --repo "$TARGET_REPO" --body "$PROD_SOURCE_READONLY_SSH_KEY"
gh secret set PROD_MIRROR_PUSH_TOKEN --repo "$TARGET_REPO" --body "$PROD_MIRROR_PUSH_TOKEN"
gh variable set PROD_SOURCE_BRANCH --repo "$TARGET_REPO" --body "$PROD_SOURCE_BRANCH"
gh variable set PROD_MIRROR_TARGET_BRANCH --repo "$TARGET_REPO" --body "$PROD_MIRROR_TARGET_BRANCH"
gh variable set MIRROR_NOTIFY_SUCCESS --repo "$TARGET_REPO" --body "$MIRROR_NOTIFY_SUCCESS"

if [[ -n "${MIRROR_TELEGRAM_BOT_TOKEN:-}" && -n "${MIRROR_TELEGRAM_CHAT_ID:-}" ]]; then
  gh secret set MIRROR_TELEGRAM_BOT_TOKEN --repo "$TARGET_REPO" --body "$MIRROR_TELEGRAM_BOT_TOKEN"
  gh secret set MIRROR_TELEGRAM_CHAT_ID --repo "$TARGET_REPO" --body "$MIRROR_TELEGRAM_CHAT_ID"
  echo "Telegram secrets configured."
else
  echo "Telegram secrets skipped (set MIRROR_TELEGRAM_BOT_TOKEN and MIRROR_TELEGRAM_CHAT_ID to configure)."
fi

echo "Done. Run the workflow manually from GitHub Actions: Prod Mirror Sync."
