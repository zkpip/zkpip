#!/usr/bin/env bash
# Generate a valid Groth16 fixture from local circuit artifacts using snarkjs 0.7.5.
# Usage: bash groth16_make_valid.sh
set -euo pipefail

# --- Config ---
SNARKJS="${SNARKJS:-npx -y snarkjs@0.7.5}"   # override with absolute path if needed
ROOT="${ROOT:-$PWD}"                          # repo root
ART="${ART:-$ROOT/.tmp/groth16}"              # work dir for generated files
FIX_VALID="${FIX_VALID:-$ROOT/fixtures/snarkjs-groth16/valid}"

# Power-of-tau exponent. Ensure 2^P >= number of constraints in your circuit.
# If setup complains, re-run with a higher P (e.g. 14).
P="${P:-12}"

echo "==> Setup"
mkdir -p "$ART" "$FIX_VALID"

# Copy user-provided artifacts into work dir if present in current dir
for f in circuit.r1cs circuit.wasm witness.wtns input.json; do
  if [[ -f "$ROOT/$f" && ! -f "$ART/$f" ]]; then
    cp "$ROOT/$f" "$ART/"
  fi
done

cd "$ART"

echo "==> (Info) r1cs details"
$SNARKJS r1cs info circuit.r1cs || true
echo "    If constraints exceed 2^$P, re-run with P=<higher>."

# Optional: recompute witness if needed (uses input.json)
if [[ -f "circuit.wasm" && -f "input.json" ]]; then
  echo "==> (Optional) recomputing witness from input.json"
  $SNARKJS wtns calculate circuit.wasm input.json witness.wtns
fi

echo "==> Powers of Tau (phase1)"
$SNARKJS powersoftau new bn128 "$P" "pot${P}_0000.ptau" -v
$SNARKJS powersoftau contribute "pot${P}_0000.ptau" "pot${P}_0001.ptau" -e="local test entropy" -v

echo "==> Prepare phase2"
$SNARKJS powersoftau prepare phase2 "pot${P}_0001.ptau" "pot${P}_final.ptau" -v

echo "==> Groth16 setup (phase2 -> zkey)"
$SNARKJS groth16 setup circuit.r1cs "pot${P}_final.ptau" circuit_0000.zkey -v
$SNARKJS zkey contribute circuit_0000.zkey circuit_final.zkey -e="second pass entropy" -v

echo "==> Export verification key"
$SNARKJS zkey export verificationkey circuit_final.zkey verification_key.json

echo "==> Prove"
$SNARKJS groth16 prove circuit_final.zkey witness.wtns proof.json public.json

echo '==> Build proof-bundle.valid.json'
if command -v jq >/dev/null 2>&1; then
  jq -n \
    --slurpfile vk verification_key.json \
    --slurpfile pf proof.json \
    --slurpfile pb public.json \
    '{ bundle: { verification_key: $vk[0], proof: $pf[0], public: $pb[0] } }' \
    > "$FIX_VALID/proof-bundle.valid.json"
else
  # Fallback without jq (Node-based bundler)
  node -e 'const fs=require("fs");const vk=JSON.parse(fs.readFileSync("verification_key.json","utf8"));const pf=JSON.parse(fs.readFileSync("proof.json","utf8"));const pb=JSON.parse(fs.readFileSync("public.json","utf8"));fs.writeFileSync(process.argv[1],JSON.stringify({bundle:{verification_key:vk,proof:pf,public:pb}},null,2));' "$FIX_VALID/proof-bundle.valid.json"
fi

echo "==> Make verification.json"
node "$ROOT/scripts/make-verification-json.mjs" \
  --framework=snarkjs --proofSystem=groth16 \
  --in="$FIX_VALID/proof-bundle.valid.json" \
  --out="$FIX_VALID/verification.json"

echo "==> DONE."
echo "Artifacts:"
echo "  $FIX_VALID/proof-bundle.valid.json"
echo "  $FIX_VALID/verification.json"
