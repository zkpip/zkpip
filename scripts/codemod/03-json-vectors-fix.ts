// ESM, strict TS. Run with: VECTOR_DIR=packages/core/schemas/tests/vectors node --loader tsx scripts/codemod/03-json-vectors-fix.ts
// Purpose: update JSON vectors: titles, $id, path-like strings, and top-level keys proofBundle->proofEnvelope.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const VECTOR_DIR = process.env.VECTOR_DIR ? resolve(process.env.VECTOR_DIR) : undefined;
if (!VECTOR_DIR) {
  throw new Error('Set VECTOR_DIR env var to the vectors root (e.g., packages/core/schemas/tests/vectors)');
}

const DRY_RUN = process.env.DRY_RUN === '1';

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (p.endsWith('.json')) acc.push(p);
  }
  return acc;
}

// Safe textual replacements for JSON (we will also try structured key rename at root)
const TEXT_REPL: Array<{ re: RegExp; to: string }> = [
  { re: /urn:zkpip:mvs:proof-bundle/g, to: 'urn:zkpip:mvs:proof-envelope' },
  { re: /\bProof Bundle\b/g, to: 'Proof Envelope' },
  { re: /\bproof-bundle\b/g, to: 'proof-envelope' }
];

function transformJsonText(src: string): string {
  let out = src;
  for (const { re, to } of TEXT_REPL) out = out.replace(re, to);
  return out;
}

function remapRootKey(obj: unknown): unknown {
  // If top-level has proofBundle -> rename to proofEnvelope
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const rec = obj as Record<string, unknown>;
    if ('proofBundle' in rec && !('proofEnvelope' in rec)) {
      const clone: Record<string, unknown> = { ...rec };
      clone.proofEnvelope = clone.proofBundle;
      delete clone.proofBundle;
      return clone;
    }
  }
  return obj;
}

const files = walk(VECTOR_DIR);
let changed = 0;

for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  let txt = transformJsonText(raw);

  // Structured root-key remap if JSON parses
  try {
    const parsed = JSON.parse(txt) as unknown;
    const remapped = remapRootKey(parsed);
    const pretty = JSON.stringify(remapped, null, 2);
    if (pretty !== raw) {
      changed++;
      if (!DRY_RUN) writeFileSync(f, pretty, 'utf8');
      console.log(`${DRY_RUN ? '[DRY] ' : ''}updated JSON: ${f}`);
      continue;
    }
  } catch {
    // If invalid JSON (e.g. comments), fall back to text-only; write only if text changed
  }

  if (txt !== raw) {
    changed++;
    if (!DRY_RUN) writeFileSync(f, txt, 'utf8');
    console.log(`${DRY_RUN ? '[DRY] ' : ''}updated (text-only): ${f}`);
  }
}

console.log(`${DRY_RUN ? '[DRY] ' : ''}json vector updates: ${changed} file(s) changed.`);
