#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 0 ]; then
  echo "Aquest MCP no accepta arguments." >&2
  exit 2
fi

PROJECT_DIR="/Users/raulvico/Documents/summa-social"
KEYCHAIN_SERVICE="summa-social-mcp-flores-prepare-only"
KEYCHAIN_ACCOUNT="SkQjWvCRDJhSf1OeJAw9"

cd "$PROJECT_DIR"

export SUMMA_BASE_URL="https://studio--summa-social.us-central1.hosted.app"
export SUMMA_ORG_ID="SkQjWvCRDJhSf1OeJAw9"
export SUMMA_MCP_EXPECTED_ORG_NAME="Fundación Flores de Kiskeya"
export SUMMA_SOURCE_REPO="codex-summa-mcp-flores"
export SUMMA_MCP_OUTPUT_DIR="${SUMMA_MCP_OUTPUT_DIR:-/Users/raulvico/Downloads/Summa-Certificats}"
export SUMMA_MCP_ENABLED_TOOLS="search_bank_accounts,search_transactions,search_contacts,preview_bank_statement_import,prepare_bank_statement_import_plan,commit_bank_statement_import,prepare_donation_classification,prepare_donation_classification_plan,apply_donation_classification,prepare_individual_donation_certificate,generate_individual_donation_certificate"
if [[ ! -d "$SUMMA_MCP_OUTPUT_DIR" ]]; then
  echo "Crea primer la carpeta segura de certificats: $SUMMA_MCP_OUTPUT_DIR" >&2
  exit 1
fi
unset SUMMA_PRIVATE_INTEGRATION_TOKEN

node --import tsx scripts/integrations/verify-private-mcp-organization.ts

token="$(security find-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$KEYCHAIN_SERVICE" -w)"
if [[ "$token" != summa_it_* ]]; then
  echo "No hi ha un token privat vàlid al Clauer del Mac." >&2
  exit 1
fi

export SUMMA_PRIVATE_INTEGRATION_TOKEN="$token"
unset token

exec node --import tsx scripts/summa-agent-mcp.ts
