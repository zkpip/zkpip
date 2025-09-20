// ESM, strict TS. Run with: node --loader tsx scripts/codemod/01-content-codemod.ts
// Purpose: repo-wide textual rename: ProofBundle -> ProofEnvelope, flags, URNs, etc.
// Safe by default: skips node_modules, dist, .git, package-lock.json, etc.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const INCLUDE_EXTS = new Set(['.ts', '.tsx', '.md']); // JSON vectors külön lépésben
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.tmp', '.cache'
]);

// Dry-run: set DRY_RUN=1 env var
const DRY_RUN = process.env.DRY_RUN === '1';

function hasExt(p: string, exts: Set<string>): boolean {
  for (const ext of exts) if (p.endsWith(ext)) return true;
  return false;
}

function shouldSkipDir(name: string): boolean {
  return EXCLUDE_DIRS.has(name);
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!shouldSkipDir(entry)) walk(full, acc);
    } else {
      if (hasExt(full, INCLUDE_EXTS)) acc.push(full);
    }
  }
  return acc;
}

// Ordered replacements (word-boundary where possible to reduce overmatch)
const REPLACEMENTS: Array<{ re: RegExp; to: string; note: string }> = [
  // Types / identifiers
  { re: /\bProofBundle\b/g, to: 'ProofEnvelope', note: 'Type identifier' },
  { re: /\bproofBundle\b/g, to: 'proofEnvelope', note: 'camelCase field' },

  // Kebab forms (paths, file names in content)
  { re: /\bproof-bundle\b/g, to: 'proof-envelope', note: 'kebab token' },

  // CLI flags in docs/code
  { re: /--bundle\b/g, to: '--envelope', note: 'CLI flag' },

  // URN namespace (keep order: longer first is safe with global)
  { re: /urn:zkpip:mvs:proof-bundle/g, to: 'urn:zkpip:mvs:proof-envelope', note: 'URN base' },

  // Titles in docs
  { re: /\bProof Bundle\b/g, to: 'Proof Envelope', note: 'Title-case phrase' },
];

let changed = 0;
const files = walk(ROOT);
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let after = before;
  for (const { re, to } of REPLACEMENTS) after = after.replace(re, to);
  if (after !== before) {
    changed++;
    if (!DRY_RUN) writeFileSync(f, after, 'utf8');
    console.log(`${DRY_RUN ? '[DRY] ' : ''}updated: ${f}`);
  }
}
console.log(`${DRY_RUN ? '[DRY] ' : ''}done. files changed: ${changed}`);
