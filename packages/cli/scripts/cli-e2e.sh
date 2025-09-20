#!/usr/bin/env bash
set -euo pipefail

# --- env check ---
need() { command -v "$1" >/dev/null 2>&1 || { echo "Hiányzó parancs: $1" >&2; exit 1; }; }
need node; need python3
command -v jq >/dev/null 2>&1 && echo "jq: $(jq --version)" || true

# --- paths ---
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}" )" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR" && git rev-parse --show-toplevel 2>/dev/null || echo "$(cd -- "$SCRIPT_DIR/../../.." && pwd)")"
CLI="$ROOT/packages/cli/dist/index.js"
VROOT="$ROOT/packages/core/schemas/tests/vectors/mvs/verification"

VALID_BUNDLE="$VROOT/proof-envelope.valid.json"
INVALID_BUNDLE="$VROOT/proof-envelope.invalid.json"
PUBLIC_INVALID="$VROOT/public.invalid.json"

# --- helpers ---
abs() {
  python3 - "$1" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
}

first_signal() {
  python3 - "$1" <<'PY'
import json, sys

data = json.load(open(sys.argv[1], "r", encoding="utf-8"))

def first_public_signal(obj):
    if isinstance(obj, list):
        if not obj:
            raise SystemExit("publicSignals: empty array")
        return obj[0]
    if isinstance(obj, dict):
        r = obj.get("result")
        if isinstance(r, dict) and isinstance(r.get("publicSignals"), list):
            arr = r["publicSignals"]
            if not arr:
                raise SystemExit("result.publicSignals: empty array")
            return arr[0]
        if isinstance(obj.get("publicSignals"), list):
            arr = obj["publicSignals"]
            if not arr:
                raise SystemExit("publicSignals: empty array")
            return arr[0]
    raise SystemExit("No publicSignals found in input")

print(first_public_signal(data))
PY
}

# --- build (workspace script, nem hívunk közvetlen tsc-t) ---
echo "==> Clean install & build all workspaces..."
npm i >/dev/null 2>&1 || npm i
npm run -ws build

# --- show bundles ---
echo "==> Bundles in use:"
echo "ROOT          : $ROOT"
echo "VALID_BUNDLE  : $VALID_BUNDLE"
echo "INVALID_BUNDLE: $INVALID_BUNDLE"
echo "PUBLIC_INVALID: $PUBLIC_INVALID"

# --- sanity check ---
echo "==> VALID JSON OK: $VALID_BUNDLE"
jq . "$VALID_BUNDLE" >/dev/null

echo "==> INVALID JSON OK: $INVALID_BUNDLE"
jq . "$INVALID_BUNDLE" >/dev/null

echo "==> PUBLIC_INVALID JSON OK: $PUBLIC_INVALID"
jq . "$PUBLIC_INVALID" >/dev/null

echo "==> hash(VALID_BUNDLE): $(sha256sum "$VALID_BUNDLE" | cut -d' ' -f1)"

# --- extract first signals (debug) ---
VALID_FIRST="$(first_signal "$VALID_BUNDLE")"
INVALID_FIRST="$(first_signal "$PUBLIC_INVALID")"

echo "==> Inline first publicSignal from VALID  : $VALID_FIRST"
echo "==> Inline first publicSignal from INVALID: $INVALID_FIRST"

# --- smoke test ---
echo "==> Smoke: verify valid (expect exit 0)"
node "$CLI" verify \
  --envelope "$(abs "$VALID_BUNDLE")" \
  --adapter snarkjs-groth16 \
  --json \
  --exit-codes

set +e
echo "==> Smoke: verify invalid (expect exit 1)"
node "$CLI" verify \
  --envelope "$(abs "$INVALID_BUNDLE")" \
  --adapter snarkjs-groth16 \
  --json \
  --exit-codes
RC=$?
set -e
echo "Exit code: $RC"

if [ "$RC" -ne 1 ]; then
  echo "ERROR: expected EXIT=1 for INVALID, got $RC"
  exit 1
fi

echo "==> e2e completed successfully."
