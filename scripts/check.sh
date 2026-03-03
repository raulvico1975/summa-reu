#!/usr/bin/env bash
set -euo pipefail
npm run docs:check
node scripts/ci/check-doc-sync.mjs
node scripts/check-build-env.mjs
npx tsc --noEmit
npm test
npm run build
echo "CHECK_OK"
