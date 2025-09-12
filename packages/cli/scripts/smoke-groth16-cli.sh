#!/usr/bin/env bash
set -euo pipefail

# --- Resolve paths -----------------------------------------------------------
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/../../.. && pwd)"
CLI="$ROOT/packages/cli/dist/index.js"
ADAPTER="snarkjs-groth16"

choose() { # first existing file from args
  for f in "$@"; do [ -f "$f" ] && { echo "$f"; return 0; }; done
  return 1
}

DEF_VALID_A="$ROOT/fixtures/snarkjs-groth16/valid/verification.json"
DEF_VALID_B="$ROOT/fixtures/zokrates-groth16/valid/verification.json"
DEF_INVALID_A="$ROOT/fixtures/snarkjs-groth16/invalid/verification.json"
DEF_INVALID_B="$ROOT/fixtures/zokrates-groth16/invalid/verification.json"

VALID_JSON="${ZKPIP_VALID:-$(choose "$DEF_VALID_A" "$DEF_VALID_B" || true)}"
INVALID_JSON="${ZKPIP_INVALID:-$(choose "$DEF_INVALID_A" "$DEF_INVALID_B" || true)}"

: "${VALID_JSON:?ERROR: Missing valid bundle. Tried: $DEF_VALID_A or $DEF_VALID_B}"
: "${INVALID_JSON:?ERROR: Missing invalid bundle. Tried: $DEF_INVALID_A or $DEF_INVALID_B}"

echo "CLI:          $CLI"
echo "Adapter:      $ADAPTER"
echo "Valid JSON:   $VALID_JSON"
echo "Invalid JSON: $INVALID_JSON"

for f in "$VALID_JSON" "$INVALID_JSON"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing $f"
    exit 1
  fi
done

# --- Dump dir & logging ------------------------------------------------------
DUMP_DIR="$ROOT/packages/cli/.tmp/normalized"
mkdir -p "$DUMP_DIR"
rm -f "$DUMP_DIR"/*.json 2>/dev/null || true
export ZKPIP_DUMP_NORMALIZED="$DUMP_DIR"
export ZKPIP_LOG_AUTONORM="${ZKPIP_LOG_AUTONORM:-1}"

# --- Run valid (expect exit 0) ----------------------------------------------
echo "==> Valid (expect exit 0)"
node "$CLI" verify \
  --adapter "$ADAPTER" \
  --verification "$VALID_JSON" \
  --json --use-exit-codes --dump-normalized "$DUMP_DIR"

# Inline dump-check: vkey+IC, IC.length === publics.length+1, proof has pi_a/b/c
node -e '
  const fs=require("fs"), path=require("path");
  const dir=process.env.ZKPIP_DUMP_NORMALIZED;
  const files=fs.readdirSync(dir).filter(f=>/^normalized\..*\.json$/.test(f))
    .map(f=>path.join(dir,f)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
  if(!files.length){console.error("No normalized dumps"); process.exit(1);}
  const j=JSON.parse(fs.readFileSync(files[0],"utf8"));
  if(!j.vkey||!j.proof||!j.publics){console.error("Dump missing vkey/proof/publics"); process.exit(1);}
  if(!Array.isArray(j.publics)){console.error("publics not array"); process.exit(1);}
  const ic=j.vkey?.IC;
  if(Array.isArray(ic) && ic.length !== j.publics.length + 1){
    console.error(`IC length mismatch: ${ic.length} vs ${j.publics.length+1}`); process.exit(1);
  }
  if(!(j.proof?.pi_a && j.proof?.pi_b && j.proof?.pi_c)){
    console.error("proof shape invalid (missing pi_a/pi_b/pi_c)"); process.exit(1);
  }
  console.log("Dump-check OK:", files[0]);
'

# --- Run invalid (expect exit 1) --------------------------------------------
echo "==> Invalid (expect exit 1)"
! node "$CLI" verify \
  --adapter "$ADAPTER" \
  --verification "$INVALID_JSON" \
  --json --use-exit-codes --dump-normalized "$DUMP_DIR"

echo "Groth16 (snarkjs) smoke: OK"
