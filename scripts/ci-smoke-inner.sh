#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DAILY_MOCK_MODE=true
export DAILY_DOMAIN=mock.daily.local
export DAILY_WEBHOOK_BEARER_TOKEN=smoke-secret
export MEETING_INGEST_MOCK_MODE=true

npm run i18n:check-es

next dev --hostname 127.0.0.1 --port 3000 >/tmp/summa-next-dev.log 2>&1 &
NEXT_PID=$!

cleanup() {
  if kill -0 "$NEXT_PID" >/dev/null 2>&1; then
    kill "$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 120); do
  if curl -fs "http://127.0.0.1:3000/login" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -fs "http://127.0.0.1:3000/login" >/dev/null; then
  echo "Next server not ready after 120 seconds."
  tail -n 80 /tmp/summa-next-dev.log || true
  exit 1
fi

npm run seed
npm run test:smoke
