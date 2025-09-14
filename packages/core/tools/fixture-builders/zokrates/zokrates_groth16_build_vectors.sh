#!/usr/bin/env bash
# Robust ZoKrates Groth16 vector builder
# - Works with `set -euo pipefail`
# - Allocates WORK *before* trap to avoid unbound var
# - Emits ProofEnvelope v1 (framework, proofSystem, verificationKey, proof, publics)
# - No artifacts.path; meta.sourceDir kept for info

set -euo pipefail

# Resolve repo root (script is at packages/core/tools/fixture-builders/zokrates/)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." >/dev/null 2>&1 && pwd)"

# Output dirs
OUT_DIR_VALID="$REPO_ROOT/fixtures/zokrates-groth16/valid"
OUT_DIR_INVALID="$REPO_ROOT/fixtures/zokrates-groth16/invalid"
mkdir -p "$OUT_DIR_VALID" "$OUT_DIR_INVALID"

# Allocate WORK *before* trap, so $WORK is always defined
WORK="${WORK:-}"
if [[ -z "${WORK}" ]]; then
  WORK="$(mktemp -d -t zkpip-zo-XXXXXX)"
fi
export WORK
echo "→ WORK dir: $WORK"

cleanup() {
  local code=$?
  # Keep WORK if ZK_KEEP_WORK=1
  if [[ "${ZK_KEEP_WORK:-0}" = "1" ]]; then
    echo "→ Keeping WORK (ZK_KEEP_WORK=1): $WORK"
  else
    if [[ -n "${WORK:-}" && -d "$WORK" ]]; then
      rm -rf "$WORK"
    fi
  fi
  exit $code
}
trap cleanup EXIT INT TERM

# Resolve ZoKrates binary
ZOKRATES_BIN="${ZOKRATES_BIN:-zokrates}"
if ! command -v "$ZOKRATES_BIN" >/dev/null 2>&1; then
  echo "ZoKrates CLI is required on PATH (or set ZOKRATES_BIN)." >&2
  exit 127
fi

# Create tiny circuit: out = a + b; publics = [out]
cat >"$WORK/add.zok" <<'ZOK'
// ZoKrates 0.8.x: return type without parentheses.
// Return value becomes part of public inputs.
def main(private field a, private field b) -> field {
  return a + b;
}
ZOK

pushd "$WORK" >/dev/null

# Compile, setup, witness, proof
"$ZOKRATES_BIN" compile -i add.zok -o out
"$ZOKRATES_BIN" setup
"$ZOKRATES_BIN" compute-witness -a 3 9
"$ZOKRATES_BIN" generate-proof

# ZoKrates emits:
# - verification.key (text)
# - proof.json      (ZoKrates shape: {proof:{a,b,c}, inputs:[...]})
# We also want a snarkjs-compatible verification_key.json (JSON).
# If you already have JSON VK nearby, adjust paths; else, convert as needed.

# For now we assume you already have a snarkjs-compatible JSON VK next to proof.json.
# If not, and only the textual 'verification.key' exists, add your converter here.
# This line expects verification_key.json exists (builder TypeScript will load it):
if [[ ! -f "$WORK/verification_key.json" ]]; then
  if [[ -f "$WORK/verification.key" ]]; then
    echo "→ Converting verification.key → verification_key.json"
      npx -y tsx "$SCRIPT_DIR/convertVkTxtToJson.ts" \
        --in  "$WORK/verification.key" \
        --out "$WORK/verification_key.json"
  else
    echo "Missing verification.key in $WORK" >&2
    exit 2
  fi
fi

popd >/dev/null

# Use the TS builder to emit ProofEnvelope v1
npx -y tsx "$SCRIPT_DIR/makeVerificationJson.ts" \
  --proof  "$WORK/proof.json" \
  --vk     "$WORK/verification_key.json" \
  --out    "$OUT_DIR_VALID/verification.json" \
  --source "$WORK"

# Create an invalid variant by tampering the first public input (no jq)
# NOTE: args must come BEFORE the heredoc redirection!
node - "$OUT_DIR_VALID/verification.json" "$OUT_DIR_INVALID/verification.json" <<'NODE'
const fs = require('node:fs');

// argv: [node, '-', validPath, invalidPath]
const [validPath, invalidPath] = process.argv.slice(2);

// read valid JSON
const j = JSON.parse(fs.readFileSync(validPath, 'utf8'));

// deterministically corrupt first public input
if (Array.isArray(j.publics) && j.publics.length > 0) {
  const v = String(j.publics[0]);
  j.publics[0] = /^\d+$/.test(v) ? String(BigInt(v) + 1n) : v + '_tamper';
}

// write invalid JSON pretty-printed
fs.writeFileSync(invalidPath, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('Wrote invalid:', invalidPath);
NODE

echo "✅ Wrote:"
echo "  $OUT_DIR_VALID/verification.json"
echo "  $OUT_DIR_INVALID/verification.json"
