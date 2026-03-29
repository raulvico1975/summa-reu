#!/usr/bin/env bash
set -e

VERIFY_PROFILE="${VERIFY_PROFILE:-STANDARD}"

echo "[verify-ci] Fiscal paths guardrail..."
node scripts/ci/fiscal-guardrail.mjs

echo "[verify-ci] Doc sync guardrail..."
node scripts/ci/check-doc-sync.mjs

if [ "$VERIFY_PROFILE" = "FAST_PUBLIC" ]; then
  echo "[verify-ci] Profile: FAST_PUBLIC (scope EDGE)"
  echo "[verify-ci] Typecheck..."
  npm run typecheck

  echo "[verify-ci] Checking build env..."
  node scripts/check-build-env.mjs

  echo "[verify-ci] Build..."
  npm run build

  echo "[verify-ci] OK"
  exit 0
fi

echo "[verify-ci] Fiscal oracle..."
node --import tsx scripts/fiscal/run-oracle.ts --stage=ci

echo "[verify-ci] Typecheck..."
npm run typecheck

echo "[verify-ci] Tests + coverage (report-only)..."
npm run test:coverage

echo "[verify-ci] Support golden set eval..."
npm run support:eval

echo "[verify-ci] Checking build env..."
node scripts/check-build-env.mjs

echo "[verify-ci] Build..."
npm run build

echo "[verify-ci] OK"
