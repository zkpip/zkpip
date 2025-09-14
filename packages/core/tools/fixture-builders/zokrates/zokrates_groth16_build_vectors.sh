#!/usr/bin/env bash
set -euo pipefail

# ZoKrates Groth16 vector builder (valid + invalid)
# Requires: ZoKrates CLI, Node.js; uses tsx via npx.
# Outputs:
#   fixtures/zokrates-groth16/valid/verification.json
#   fixtures/zokrates-groth16/invalid/verification.json

# --- Paths --------------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Prefer Git to find repo root (works from any subdir); fallback to 5x ".."
if ROOT_GIT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null); then
  ROOT="$ROOT_GIT"
else
  ROOT="$(cd -- "$SCRIPT_DIR/../../../../.." && pwd)"
fi

OUT_VALID="$ROOT/fixtures/zokrates-groth16/valid"
OUT_INVALID="$ROOT/fixtures/zokrates-groth16/invalid"
TMP_DIR="$(mktemp -d)"
ZOK_MAIN="$TMP_DIR/add.zok"

# TS helpers live NEXT TO this script → no ROOT math needed for them
TS_MAKE_VER="$SCRIPT_DIR/makeVerificationJson.ts"
TS_MAKE_INVALID="$SCRIPT_DIR/makeInvalidFromValid.ts"

mkdir -p "$OUT_VALID" "$OUT_INVALID"

# --- Tooling checks -----------------------------------------------------------
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 2; }

run_ts() {
  if command -v tsx >/dev/null 2>&1; then
    tsx "$@"
  else
    npx -y tsx "$@"
  fi
}

# Resolve ZoKrates binary: env → PATH → ~/.zokrates/bin/zokrates
ZOKRATES_BIN="${ZOKRATES_BIN:-}"
if [ -z "$ZOKRATES_BIN" ]; then
  if command -v zokrates >/dev/null 2>&1; then
    ZOKRATES_BIN="$(command -v zokrates)"
  elif [ -x "$HOME/.zokrates/bin/zokrates" ]; then
    ZOKRATES_BIN="$HOME/.zokrates/bin/zokrates"
  fi
fi
[ -x "${ZOKRATES_BIN:-}" ] || { echo "ZoKrates CLI not found. Set ZOKRATES_BIN or add to PATH."; exit 2; }
ZOK() { "$ZOKRATES_BIN" "$@"; }

# Optional debug
[ "${DEBUG:-0}" = "1" ] && { echo "ROOT=$ROOT"; echo "SCRIPT_DIR=$SCRIPT_DIR"; echo "ZOKRATES_BIN=$ZOKRATES_BIN"; }

# --- 1) Minimal circuit (c = a + b)  (single return type, no parentheses)
cat > "$ZOK_MAIN" <<'ZOK'
def main(private field a, private field b) -> field {
    return a + b;
}
ZOK

# --- 2) Compile & setup
pushd "$TMP_DIR" >/dev/null
ZOK compile -i "$ZOK_MAIN" -o out
ZOK setup

# --- 3) Make a valid proof (3 + 5 = 8)
ZOK compute-witness -a 3 5
ZOK generate-proof
popd >/dev/null

# --- 4) Build ZKPIP-compatible verification.json (VALID)
run_ts "$TS_MAKE_VER" \
  --proof "$TMP_DIR/proof.json" \
  --vk "$TMP_DIR/verification.key" \
  --out "$OUT_VALID/verification.json"

# --- 5) Derive an INVALID vector by tampering publics
run_ts "$TS_MAKE_INVALID" \
  --in "$OUT_VALID/verification.json" \
  --out "$OUT_INVALID/verification.json"

echo "✅ Wrote:"
echo "  $OUT_VALID/verification.json"
echo "  $OUT_INVALID/verification.json"

rm -rf "$TMP_DIR"
