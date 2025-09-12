#!/usr/bin/env bash
set -euo pipefail

# Generate tiny ZoKrates Groth16 vectors (valid + invalid) for smoke tests.
# Prefers Docker image `zokrates/zokrates`. Falls back to local `zokrates` binary if available.
# Outputs to: packages/core/schemas/tests/vectors/mvs/verification/zokrates-groth16/{valid,invalid}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CORE_ROOT="$(cd -- "$CLI_ROOT/../core" && pwd)"

VROOT="$CORE_ROOT/schemas/tests/vectors/mvs/verification/zokrates-groth16"
VALID_DIR="$VROOT/valid"
INVALID_DIR="$VROOT/invalid"
mkdir -p "$VALID_DIR" "$INVALID_DIR"

BUILD_DIR="$(mktemp -d -t zkpip-zok-XXXXXX)"
cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

have() { command -v "$1" >/dev/null 2>&1; }
RUNNER=""
if have docker; then
  RUNNER="docker"
elif have zokrates; then
  RUNNER="local"
else
  echo "ERROR: need either Docker or local 'zokrates' binary" >&2
  exit 2
fi

echo "Build dir: $BUILD_DIR"
cd "$BUILD_DIR"

cat > square.zok <<'ZOK'
def main(private field a, field b) {
  field c = a * a;
  assert(c == b);
}
ZOK

CONTAINER_WORK="/home/zokrates/code"

zok() {
  if [ "$RUNNER" = "docker" ]; then
    docker run --rm \
      -u "$(id -u):$(id -g)" \
      -v "$BUILD_DIR":"$CONTAINER_WORK" \
      -w "$CONTAINER_WORK" \
      zokrates/zokrates:latest \
      zokrates "$@"
  else
    zokrates "$@"
  fi
}

BACKEND="${ZOK_BACKEND:-ark}"
SCHEME="${ZOK_SCHEME:-g16}"

# Compile, setup, witness, proof
zok compile -i square.zok -o out
zok setup \
  --backend "$BACKEND" \
  --input out \
  --proving-scheme "$SCHEME" \
  --proving-key-path proving.key \
  --verification-key-path verification.key

zok compute-witness --input out -a 3 9

zok generate-proof \
  --input out \
  --proving-scheme "$SCHEME" \
  --proving-key-path proving.key

# valid triplet
cp verification.key "$VALID_DIR/verification.key"
cp proof.json       "$VALID_DIR/proof.json"
jq '.inputs' proof.json > "$VALID_DIR/public.json"

# sanity
zok verify --proof-path proof.json --verification-key-path verification.key || {
  echo "ZoKrates verify failed"; exit 1;
}

# invalid #1: tamper publics → verification_failed
cp "$VALID_DIR/verification.key" "$INVALID_DIR/verification.key"
cp "$VALID_DIR/proof.json"       "$INVALID_DIR/proof.json"
jq '.[0]="0x1"' "$VALID_DIR/public.json" > "$INVALID_DIR/public.json"

# invalid #2: adapter_error (broken JSON)
echo '{ "notClosed": true ' > "$INVALID_DIR/broken_proof.json"

echo "Done."
echo "Valid   → $VALID_DIR"
echo "Invalid → $INVALID_DIR"
