#!/usr/bin/env bash
set -euo pipefail

SERVICE_PREFIX="summaboard"
ENV_FILE=".env.local"

usage() {
  cat <<USAGE
Ús:
  scripts/secrets-keychain.sh set <KEY> <VALUE>
  scripts/secrets-keychain.sh get <KEY>
  scripts/secrets-keychain.sh del <KEY>
  scripts/secrets-keychain.sh write-env [output_file]

Exemples:
  scripts/secrets-keychain.sh set GEMINI_API_KEY "xxxx"
  scripts/secrets-keychain.sh set FIREBASE_CLIENT_EMAIL "service@project.iam.gserviceaccount.com"
  scripts/secrets-keychain.sh get GEMINI_API_KEY
  scripts/secrets-keychain.sh write-env
USAGE
}

svc() {
  local key="$1"
  echo "${SERVICE_PREFIX}/${key}"
}

escape_env() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

set_secret() {
  local key="$1"
  local value="$2"
  security add-generic-password -a "$USER" -s "$(svc "$key")" -w "$value" -U >/dev/null
  echo "Guardat a Keychain: $key"
}

get_secret() {
  local key="$1"
  security find-generic-password -a "$USER" -s "$(svc "$key")" -w
}

del_secret() {
  local key="$1"
  security delete-generic-password -a "$USER" -s "$(svc "$key")" >/dev/null
  echo "Eliminat de Keychain: $key"
}

write_env() {
  local output="${1:-$ENV_FILE}"

  if [[ -f .env.example ]]; then
    cp .env.example "$output"
  else
    : > "$output"
  fi

  local keys=(
    GEMINI_API_KEY
    GEMINI_MODEL
    GEMINI_BASE_URL
    TELEGRAM_BOT_TOKEN
    TELEGRAM_CHAT_ID
    FIREBASE_CLIENT_EMAIL
    FIREBASE_PRIVATE_KEY
    FIREBASE_PRIVATE_KEY_ID
    FIREBASE_PROJECT_ID
    FIREBASE_STORAGE_BUCKET
  )

  for key in "${keys[@]}"; do
    if value="$(security find-generic-password -a "$USER" -s "$(svc "$key")" -w 2>/dev/null)"; then
      local escaped
      escaped="$(escape_env "$value")"
      if grep -q "^${key}=" "$output" 2>/dev/null; then
        sed -i '' "s#^${key}=.*#${key}=${escaped}#" "$output"
      else
        echo "${key}=${escaped}" >> "$output"
      fi
    fi
  done

  chmod 600 "$output"
  echo "Env escrit a: $output"
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    set)
      [[ $# -ge 3 ]] || { usage; exit 1; }
      set_secret "$2" "$3"
      ;;
    get)
      [[ $# -eq 2 ]] || { usage; exit 1; }
      get_secret "$2"
      ;;
    del)
      [[ $# -eq 2 ]] || { usage; exit 1; }
      del_secret "$2"
      ;;
    write-env)
      write_env "${2:-$ENV_FILE}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
