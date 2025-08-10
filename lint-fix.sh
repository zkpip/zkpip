#!/usr/bin/env bash
# Run ESLint --fix for the @zkpip/core workspace, then re-check

set -euo pipefail

echo "[lint-fix] Checking repo..."
git rev-parse --is-inside-work-tree >/dev/null

if [ ! -d "node_modules" ]; then
  echo "[lint-fix] Installing dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi
fi

if npm run -s -w @zkpip/core lint:fix >/dev/null 2>&1; then
  echo "[lint-fix] Running lint:fix..."
  npm run -w @zkpip/core lint:fix
else
  echo "[lint-fix] No 'lint:fix' script found. Falling back to 'lint -- --fix'..."
  npm run -w @zkpip/core lint -- --fix
fi

echo "[lint-fix] Re-running strict lint check..."
bash "$(dirname "$0")/lint-check.sh"

echo "[lint-fix] Lint fixed and verified."
