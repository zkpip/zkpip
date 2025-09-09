#!/usr/bin/env bash
set -euo pipefail

# Wrapper to run the PLONK vector generator from the CLI package.
# Works regardless of the current working directory.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"  # packages/cli

# Prefer the canonical name, but accept the earlier 'plon' variant too.
GEN="$SCRIPT_DIR/generate-plonk-vectors.sh"
if [ ! -f "$GEN" ]; then
  GEN="$SCRIPT_DIR/generate-plon-vectors.sh"
fi

if [ ! -f "$GEN" ]; then
  echo "ERROR: generator script not found. Expected one of:"
  echo "  - $SCRIPT_DIR/generate-plonk-vectors.sh"
  echo "  - $SCRIPT_DIR/generate-plon-vectors.sh"
  exit 1
fi

# Ensure executable bit, but don't fail if we can't (we call via bash anyway)
[ -x "$GEN" ] || chmod +x "$GEN" || true

echo "Using generator: $GEN"
# Proxy BUILD_DIR if provided (keeps artifacts for debugging), else ephemeral build in generator
if [ -n "${BUILD_DIR-}" ]; then
  BUILD_DIR="$BUILD_DIR" bash "$GEN"
else
  bash "$GEN"
fi

echo "run-plonk-vectors: done."
