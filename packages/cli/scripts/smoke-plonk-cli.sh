#!/usr/bin/env bash
set -euo pipefail

# Smoke-run the CLI 'verify' against generated PLONK vectors.
# Works regardless of the current working directory.

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing dependency: $1" >&2; exit 2; }; }
need node

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"            # packages/cli
CORE_ROOT="$(cd -- "$CLI_ROOT/../core" && pwd)"        # packages/core

CLI_DIST="$CLI_ROOT/dist/index.js"
VECTORS_DIR="$CORE_ROOT/schemas/tests/vectors/mvs/verification/snarkjs-plonk"
VALID_DIR="$VECTORS_DIR/valid"
INVALID_DIR="$VECTORS_DIR/invalid"

# Build CLI if dist is missing
if [ ! -f "$CLI_DIST" ]; then
  echo "CLI dist not found, building..."
  npm -w @zkpip/cli run build
fi

echo "CLI: $CLI_DIST"
echo "Vectors: $VECTORS_DIR"

# Valid should exit 0
echo "==> Valid (expect exit 0)"
set +e
node "$CLI_DIST" verify \
  --adapter snarkjs-plonk \
  --verification "$VALID_DIR" \
  --json \
  --use-exit-codes \
  --no-schema
RC=$?
set -e
if [ $RC -ne 0 ]; then
  echo "ERROR: valid vectors returned exit code $RC"
  exit 1
fi

# Invalid (tampered public) should exit 1
echo "==> Invalid (expect exit 1)"
set +e
node "$CLI_DIST" verify \
  --adapter snarkjs-plonk \
  --verification "$INVALID_DIR" \
  --json \
  --use-exit-codes \
  --no-schema
RC=$?
set -e
if [ $RC -ne 1 ]; then
  echo "ERROR: invalid vectors returned exit code $RC (expected 1)"
  exit 1
fi

echo "smoke-plonk-cli: OK"

# Invalid #2 (adapter_error via broken JSON) should exit 2
BROKEN="$INVALID_DIR/broken_proof.json"
echo "==> Adapter error (expect exit 2) -> $BROKEN"
set +e
node "$CLI_DIST" verify \
  --adapter snarkjs-plonk \
  --verification "$BROKEN" \
  --json \
  --use-exit-codes \
  --no-schema
RC=$?
set -e
if [ $RC -ne 2 ]; then
  echo "ERROR: adapter_error case returned exit code $RC (expected 2)"
  exit 1
fi
echo "==> Adapter error: OK"