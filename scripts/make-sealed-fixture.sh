#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SAMPLES="$ROOT/samples"
KEYDIR="$SAMPLES/keys"
SEALED="$SAMPLES/sealed.json"
MANIFEST="$SAMPLES/demo.manifest.json"

mkdir -p "$SAMPLES" "$KEYDIR"

echo "👉 Target sealed: $SEALED"
if [[ -f "$SEALED" ]]; then
  echo "✅ Already exists. Done."
  exit 0
fi

# 0) helper: run CLI (dist)
CLI="$ROOT/packages/cli/dist/index.js"
if [[ ! -f "$CLI" ]]; then
  echo "ℹ️ Building CLI..."
  npm -w @zkpip/cli run build
fi

# 1) próbálj kulcsot előállítani (különböző parancsokkal)
echo "🔑 Ensuring keys in $KEYDIR ..."
set +e
node "$CLI" keys gen --out "$KEYDIR" >/dev/null 2>&1
if [[ $? -ne 0 ]]; then
  node "$CLI" keys generate --dir "$KEYDIR" >/dev/null 2>&1
fi
if [[ $? -ne 0 ]]; then
  node "$CLI" keys make --dir "$KEYDIR" >/dev/null 2>&1
fi
set -e

# 2) ha van manifest, próbáljunk forge+seal-t (különböző alakok)
if [[ -f "$MANIFEST" ]]; then
  echo "🧩 Found manifest: $MANIFEST"
  set +e
  node "$CLI" vectors forge-seal --manifest "$MANIFEST" --key-dir "$KEYDIR" --out "$SEALED" --json >/dev/null 2>&1
  if [[ $? -ne 0 ]]; then
    node "$CLI" vectors seal --manifest "$MANIFEST" --key-dir "$KEYDIR" --out "$SEALED" --json >/dev/null 2>&1
  fi
  if [[ $? -ne 0 ]]; then
    node "$CLI" forge seal --manifest "$MANIFEST" --key-dir "$KEYDIR" --out "$SEALED" --json >/dev/null 2>&1
  fi
  set -e
fi

# 3) ha még mindig nincs, próbáld a belső scriptet (gen-can-vectors.mjs)
if [[ ! -f "$SEALED" && -f "$ROOT/scripts/gen-can-vectors.mjs" ]]; then
  echo "🛠  Trying scripts/gen-can-vectors.mjs ..."
  set +e
  # legvalószínűbb flag-kombók
  node "$ROOT/scripts/gen-can-vectors.mjs" --in "$MANIFEST" --key-dir "$KEYDIR" --out "$SEALED" >/dev/null 2>&1
  if [[ $? -ne 0 ]]; then
    node "$ROOT/scripts/gen-can-vectors.mjs" --in "$MANIFEST" --key "$KEYDIR" >/dev/null 2>&1
  fi
  set -e
fi

# 4) ellenőrzés
if [[ -f "$SEALED" ]]; then
  echo "✅ Sealed fixture created at $SEALED"
  exit 0
fi

echo "❌ Could not create $SEALED automatically."
echo "   Hints:"
echo "   - Ellenőrizd a helpet: node packages/cli/dist/index.js vectors --help | sed -n '1,200p'"
echo "   - Ha a forge/seal más néven fut, írd át a script 2) blokkját a helyes subcommandra."
exit 1
