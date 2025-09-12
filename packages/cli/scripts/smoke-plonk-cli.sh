#!/usr/bin/env bash
set -euo pipefail

# --- Resolve paths -----------------------------------------------------------
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/../../.. && pwd)"
CLI="$ROOT/packages/cli/dist/index.js"

ADAPTER="snarkjs-plonk"
VALID_JSON="${ZKPIP_VALID:-$ROOT/fixtures/snarkjs-plonk/valid/verification.json}"
INVALID_JSON="${ZKPIP_INVALID:-$ROOT/fixtures/snarkjs-plonk/invalid/verification.json}"

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

# Inline dump-check
node -e '
  const fs=require("fs"), path=require("path");
  const dir=process.env.ZKPIP_DUMP_NORMALIZED;
  const files=fs.readdirSync(dir).filter(f=>/^normalized\..*\.json$/.test(f))
    .map(f=>path.join(dir,f)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
  if(!files.length){console.error("No normalized dumps"); process.exit(1);}
  const j=JSON.parse(fs.readFileSync(files[0],"utf8"));
  if(!j.vkey||!j.proof||!j.publics){console.error("Dump missing vkey/proof/publics"); process.exit(1);}
  if(!Array.isArray(j.publics)){console.error("publics not array"); process.exit(1);}
  const nPub=j.vkey?.nPublic;
  if(nPub!=null && Number(nPub)!==j.publics.length){
    console.error(`nPublic mismatch: ${nPub} vs ${j.publics.length}`); process.exit(1);
  }
  console.log("Dump-check OK:", files[0]);
'

# --- Run invalid (expect exit 1) --------------------------------------------
echo "==> Invalid (expect exit 1)"
! node "$CLI" verify \
  --adapter "$ADAPTER" \
  --verification "$INVALID_JSON" \
  --json --use-exit-codes --dump-normalized "$DUMP_DIR"

echo "PLONK smoke: OK"
