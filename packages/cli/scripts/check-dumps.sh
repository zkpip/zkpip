#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <dump_dir>" >&2
  exit 2
fi

DUMP_DIR="$1"
if [ ! -d "$DUMP_DIR" ]; then
  echo "ERROR: dump dir not found: $DUMP_DIR" >&2
  exit 1
fi

# Node-based JSON validation to avoid jq dependency
node --input-type=module <<'NODE' "$DUMP_DIR"
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[1];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.error('ERROR: no dump JSON files found in', dir);
  process.exit(1);
}

let normalizedCount = 0;
let ok = true;

for (const f of files) {
  const p = path.join(dir, f);
  let j;
  try {
    j = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('ERROR: invalid JSON:', f, e.message);
    ok = false;
    continue;
  }

  // Basic sanity: meta dumps must have meta, normalized dumps must have vkey/proof/publics
  if (f.startsWith('meta.')) {
    if (!j.meta || typeof j.meta !== 'object') {
      console.error('ERROR: meta dump without meta object:', f);
      ok = false;
    }
  } else if (f.startsWith('normalized.')) {
    normalizedCount += 1;
    if (!j.vkey) {
      console.error('ERROR: normalized missing vkey:', f);
      ok = false;
    }
    if (!j.proof) {
      console.error('ERROR: normalized missing proof:', f);
      ok = false;
    }
    if (!Array.isArray(j.publics)) {
      console.error('ERROR: normalized publics not an array:', f);
      ok = false;
    }
  }
}

if (normalizedCount === 0) {
  console.error('ERROR: no normalized.*.json dumps found');
  ok = false;
}

if (!ok) process.exit(1);

console.log(`Dump check OK. Files: ${files.length}, normalized: ${normalizedCount}`);
NODE
