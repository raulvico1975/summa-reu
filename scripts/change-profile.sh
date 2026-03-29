#!/usr/bin/env bash

summa_scope_eval() {
  local files="$1"
  printf '%s\n' "$files" | node "$SCRIPT_DIR/runtime/scope-classifier.mjs" --format shell
}

summa_scope() {
  local files="$1"
  local scope_eval
  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"
  printf '%s' "$SCOPE"
}

summa_touches_core_indirectly() {
  local files="$1"
  local scope_eval
  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"
  printf '%s' "$TOUCHES_CORE_INDIRECTLY"
}

summa_risk_level() {
  local files="$1"
  local scope_eval
  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"
  printf '%s' "$RISK"
}

summa_deploy_mode() {
  local files="$1"
  local scope_eval
  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"
  printf '%s' "$DEPLOY_MODE"
}

summa_is_fast_public_scope() {
  local files="$1"
  local scope_eval
  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"
  [ "$VERIFY_PROFILE" = "FAST_PUBLIC" ]
}

summa_change_profile() {
  local files="$1"
  local scope_eval
  scope_eval="$(summa_scope_eval "$files")"
  eval "$scope_eval"
  printf '%s' "$VERIFY_PROFILE"
}
