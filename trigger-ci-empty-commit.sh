#!/usr/bin/env bash
# Trigger CI by creating an empty commit on main
# Requirements: git is configured and you have push rights to origin/main

set -euo pipefail

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo '')"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: You are on branch '$CURRENT_BRANCH'. Please checkout 'main' before running."
  exit 1
fi

# Pull latest to reduce push conflicts
git pull --ff-only origin main

# Create an empty commit to trigger CI
git commit --allow-empty -m "ci: trigger workflow for testing"

# Push to main (this triggers the GitHub Actions workflow)
git push origin main

echo "Done. CI should be running on 'main'. Check the Actions tab."
