#!/usr/bin/env bash
set -euo pipefail

# --- Paths (adjust if needed) ---
ROOT="$PWD"
ART="$ROOT/.tmp/groth16"
FIX_VALID="$ROOT/fixtures/snarkjs-groth16/valid"
mkdir -p "$ART" "$FIX_VALID"

# Put your uploaded files under $ART (or keep the paths below if they already live elsewhere)
# Copy only if not already present in $ART
[[ -f "$ART/circuit.r1cs" ]] || cp circuit.r1cs "$ART/"
[[ -f "$ART/circuit.wasm" ]] || cp circuit.wasm "$ART/"
[[ -f "$ART/witness.wtns" ]] || cp witness.wtns "$ART/"
[[ -f "$ART/input.json"   ]] || cp input.json   "$ART/"

cd "$ART"

# --- 0) (Optional) Recompute witness to be safe (uses your input.json) ---
# If your witness is already in sync with the wasm, you can skip this.
# snarkjs wtns calculate circuit.wasm input.json witness.wtns

# --- 1) Get a Powers of Tau (ptau) file ---
# Option A: QUICK (local ceremony) — good enough for tests
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_final.ptau -e="local test entropy" -v

# (If the circuit has many constraints, use a higher power than 12.
#  You can check constraints: `snarkjs r1cs info circuit.r1cs` and pick power so that 2^power >= constraints.)

# --- 2) Groth16 setup -> zkey ---
snarkjs groth16 setup circuit.r1cs pot12_final.ptau circuit_0000.zkey
# Optional extra contribution to simulate multi-party
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey -e="second pass entropy" -v

# --- 3) Export verification key ---
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# --- 4) Prove using your witness ---
snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

# --- 5) Build a proof-bundle for our generator (bundle.verification_key/proof/public) ---
jq -n \
  --slurpfile vk verification_key.json \
  --slurpfile pf proof.json \
  --slurpfile pb public.json \
  '{ bundle: { verification_key: $vk[0], proof: $pf[0], public: $pb[0] } }' \
  > "$FIX_VALID/proof-bundle.valid.json"

# --- 6) Create verification.json (our CLI input; publics will be string[]) ---
node "$ROOT/scripts/make-verification-json.mjs" \
  --framework=snarkjs --proofSystem=groth16 \
  --in="$FIX_VALID/proof-bundle.valid.json" \
  --out="$FIX_VALID/verification.json"

# --- 7) Run the CLI verify (expect ok:true + exit 0) ---
export ZKPIP_DUMP_NORMALIZED="$ROOT/.tmp/normalized"
node "$ROOT/packages/cli/dist/index.js" verify \
  --adapter snarkjs-groth16 \
  --verification "$FIX_VALID/verification.json" \
  --json --use-exit-codes ; echo " [status:$?]"

# --- 8) Inspect dumps (optional) ---
ls -la "$ROOT/.tmp/normalized/snarkjs-groth16" || true
