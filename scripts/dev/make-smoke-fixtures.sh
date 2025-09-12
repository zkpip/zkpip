#!/usr/bin/env bash
set -euo pipefail

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# --- Paths -------------------------------------------------------------------
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "${ROOT:-}" ]; then ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/../.. && pwd)"; fi

BUILD="$ROOT/fixtures/_build"
PLONK="$ROOT/fixtures/snarkjs-plonk"
G16="$ROOT/fixtures/zokrates-groth16"

mkdir -p "$BUILD" "$PLONK/valid" "$PLONK/invalid" "$G16/valid" "$G16/invalid"

command -v circom  >/dev/null || { echo "ERROR: circom not found";  exit 1; }
command -v snarkjs >/dev/null || { echo "ERROR: snarkjs not found"; exit 1; }

# --- Circuit -----------------------------------------------------------------
if [ ! -f "$BUILD/multiplier2.circom" ]; then
  log "write circuit"
  cat > "$BUILD/multiplier2.circom" <<'C'
pragma circom 2.1.5;
template Multiplier2() {
  signal input a;
  signal input b;
  signal output c;
  c <== a * b;
}
component main = Multiplier2();
C
fi

if [ ! -f "$BUILD/multiplier2.r1cs" ]; then
  log "compile circuit"
  circom "$BUILD/multiplier2.circom" --r1cs --wasm --sym -o "$BUILD"
fi

# --- Powers of Tau (phase2) --------------------------------------------------
log "powersoftau: new + contribute + prepare phase2 (clean)"
rm -f "$BUILD"/pot12_*.ptau
snarkjs powersoftau new bn128 12 "$BUILD/pot12_0000.ptau" -v
printf 'zkpip\nzkpip\n' | snarkjs powersoftau contribute "$BUILD/pot12_0000.ptau" "$BUILD/pot12_0001.ptau"
snarkjs powersoftau prepare phase2 "$BUILD/pot12_0001.ptau" "$BUILD/pot12_final.ptau"
snarkjs powersoftau verify "$BUILD/pot12_final.ptau" >/dev/null

# --- Witness -----------------------------------------------------------------
log "wtns calculate (a=3,b=11)"
cat > "$BUILD/input.valid.json" <<'J'
{ "a": "3", "b": "11" }
J
snarkjs wtns calculate \
  "$BUILD/multiplier2_js/multiplier2.wasm" \
  "$BUILD/input.valid.json" \
  "$BUILD/witness.valid.wtns"

# ============================== PLONK ========================================
log "PLONK setup"
rm -f "$PLONK/plonk.zkey"
snarkjs plonk setup "$BUILD/multiplier2.r1cs" "$BUILD/pot12_final.ptau" "$PLONK/plonk.zkey"

# NOTE: do NOT run "snarkjs zkey verify" for PLONK (can exit non-zero).
log "PLONK export vkey"
snarkjs zkey export verificationkey "$PLONK/plonk.zkey" "$PLONK/verification_key.json"

log "PLONK prove (valid)"
snarkjs plonk prove "$PLONK/plonk.zkey" "$BUILD/witness.valid.wtns" "$PLONK/proof.valid.json" "$PLONK/public.valid.json"
snarkjs plonk verify "$PLONK/verification_key.json" "$PLONK/public.valid.json" "$PLONK/proof.valid.json" >/dev/null

log "PLONK make invalid publics"
cp "$PLONK/public.valid.json" "$PLONK/public.invalid.json"
node -e "let d=require(process.argv[1]); d[0]=(Number(d[0])+1).toString(); require('fs').writeFileSync(process.argv[2], JSON.stringify(d));" \
  "$PLONK/public.valid.json" "$PLONK/public.invalid.json" >/dev/null

log "PLONK write bundles (ABSOLUTE paths)"
cat > "$PLONK/valid/verification.json" <<EOF
{ "framework":"snarkjs","proofSystem":"plonk",
  "artifacts": {
    "verificationKey": { "path":"$PLONK/verification_key.json" },
    "proof":           { "path":"$PLONK/proof.valid.json" },
    "publicSignals":   { "path":"$PLONK/public.valid.json" }
  }
}
EOF
cat > "$PLONK/invalid/verification.json" <<EOF
{ "framework":"snarkjs","proofSystem":"plonk",
  "artifacts": {
    "verificationKey": { "path":"$PLONK/verification_key.json" },
    "proof":           { "path":"$PLONK/proof.valid.json" },
    "publicSignals":   { "path":"$PLONK/public.invalid.json" }
  }
}
EOF

# ============================== Groth16 ======================================
log "Groth16 setup"
rm -f "$G16/groth16.zkey"
snarkjs groth16 setup "$BUILD/multiplier2.r1cs" "$BUILD/pot12_final.ptau" "$G16/groth16.zkey"

log "Groth16 zkey verify"
snarkjs zkey verify "$BUILD/multiplier2.r1cs" "$BUILD/pot12_final.ptau" "$G16/groth16.zkey" >/dev/null

log "Groth16 export vkey"
snarkjs zkey export verificationkey "$G16/groth16.zkey" "$G16/verification_key.json"

log "Groth16 prove (valid)"
snarkjs groth16 prove "$G16/groth16.zkey" "$BUILD/witness.valid.wtns" "$G16/proof.valid.json" "$G16/public.valid.json"
snarkjs groth16 verify "$G16/verification_key.json" "$G16/public.valid.json" "$G16/proof.valid.json" >/dev/null

log "Groth16 make invalid publics"
cp "$G16/public.valid.json" "$G16/public.invalid.json"
node -e "let d=require(process.argv[1]); d[0]=(Number(d[0])+1).toString(); require('fs').writeFileSync(process.argv[2], JSON.stringify(d));" \
  "$G16/public.valid.json" "$G16/public.invalid.json" >/dev/null

log "Groth16 write bundles (ABSOLUTE paths)"
cat > "$G16/valid/verification.json" <<EOF
{ "framework":"snarkjs","proofSystem":"groth16",
  "artifacts": {
    "verificationKey": { "path":"$G16/verification_key.json" },
    "proof":           { "path":"$G16/proof.valid.json" },
    "publicSignals":   { "path":"$G16/public.valid.json" }
  }
}
EOF
cat > "$G16/invalid/verification.json" <<EOF
{ "framework":"snarkjs","proofSystem":"groth16",
  "artifacts": {
    "verificationKey": { "path":"$G16/verification_key.json" },
    "proof":           { "path":"$G16/proof.valid.json" },
    "publicSignals":   { "path":"$G16/public.invalid.json" }
  }
}
EOF

log "Fixtures ready"
echo "  $PLONK/{valid,invalid}/verification.json"
echo "  $G16/{valid,invalid}/verification.json"
