#!/usr/bin/env bash
set -euo pipefail

# Small, reproducible PLONK vectors for smoke tests.
# Builds in a temporary directory (auto-clean), writes outputs to core vectors dir.

# --- locate repo pieces robustly ---
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"                # packages/cli
CORE_ROOT="$(cd -- "$CLI_ROOT/../core" && pwd)"           # packages/core

VECTORS_ROOT="$CORE_ROOT/schemas/tests/vectors/mvs/verification/snarkjs-plonk"
VALID_DIR="$VECTORS_ROOT/valid"
INVALID_DIR="$VECTORS_ROOT/invalid"
mkdir -p "$VALID_DIR" "$INVALID_DIR"

# --- dependencies ---
need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing dependency: $1" >&2; exit 2; }; }
need circom
need snarkjs
need jq
need curl

# --- PTAU cache (persist across runs) ---
PTAU_CACHE="${PTAU_CACHE:-$CLI_ROOT/.cache/ptau}"
mkdir -p "$PTAU_CACHE"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_10.ptau"
PTAU_FILE="$PTAU_CACHE/pot10_final.ptau"

# --- ephemeral build dir (auto-clean on exit) ---
if [[ -n "${BUILD_DIR-}" ]]; then
  # user-provided build dir (no auto-clean)
  BUILD_DIR="$(mkdir -p "$BUILD_DIR" && cd "$BUILD_DIR" && pwd)"
  EPHEMERAL=0
else
  BUILD_DIR="$(mktemp -d -t zkpip-plonk-XXXXXX)"
  EPHEMERAL=1
fi
cleanup() { [[ "$EPHEMERAL" == "1" ]] && rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

echo "Build dir: $BUILD_DIR"
cd "$BUILD_DIR"

# --- 1) tiny circuit (multiplier2) ---
cat > multiplier2.circom <<'CIR'
pragma circom 2.0.0;
template Multiplier2() {
  signal input a;
  signal input b;
  signal output c;
  c <== a * b;
}
component main = Multiplier2();
CIR

# --- 2) compile -> r1cs/wasm/sym ---
circom multiplier2.circom --r1cs --wasm --sym

# --- 3) ptau (cached) ---
[ -f "$PTAU_FILE" ] || curl -L "$PTAU_URL" -o "$PTAU_FILE"

# --- 4) setup + export vk ---
snarkjs plonk setup multiplier2.r1cs "$PTAU_FILE" circuit_final.zkey
snarkjs zkey export verificationkey circuit_final.zkey "$VALID_DIR/verification_key.json"

# --- 5) witness + proof (a=3, b=11; c=33) ---
echo '{"a":"3","b":"11"}' > input.json
snarkjs wtns calculate multiplier2_js/multiplier2.wasm input.json witness.wtns
snarkjs plonk prove circuit_final.zkey witness.wtns "$VALID_DIR/proof.json" "$VALID_DIR/public.json"

# --- 6) self-check ---
snarkjs plonk verify "$VALID_DIR/verification_key.json" "$VALID_DIR/public.json" "$VALID_DIR/proof.json"

# --- 7) invalid #1 (verification_failed): tamper public.json ---
jq '.[0]="9999"' "$VALID_DIR/public.json" > "$INVALID_DIR/public.json"
cp "$VALID_DIR/proof.json" "$INVALID_DIR/proof.json"
cp "$VALID_DIR/verification_key.json" "$INVALID_DIR/verification_key.json"

# --- 8) invalid #2 (adapter_error): broken JSON ---
echo '{ "notClosed": true ' > "$INVALID_DIR/broken_proof.json"

echo "Done."
echo "Valid   → $VALID_DIR"
echo "Invalid → $INVALID_DIR"
