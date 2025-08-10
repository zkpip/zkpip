#!/usr/bin/env bash
# Run ESLint check for the @zkpip/core workspace exactly like CI (no autofix)

set -euo pipefail

echo "[lint] Checking repo..."
git rev-parse --is-inside-work-tree >/dev/null

if [ ! -d "node_modules" ]; then
  echo "[lint] Installing dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi
fi

echo "[lint] Running workspace lint (@zkpip/core)..."
npm run -w @zkpip/core lint

echo "[lint] Done. No lint errors."
