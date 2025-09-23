// packages/core/src/__tests__/nobundleid.sanity.test.ts
// Sanity: ensure there are no remaining JSON keys named "bundleId" in the repo.
// We only look for JSON-like keys: `"bundleId"\s*:`
// and we exclude tests, builds, vendored dirs, and this file itself.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Hit = { file: string; line: number; text: string };

// Repo root: from this test file, go to workspace root
const SELF = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const CORE_DIR = resolve(SELF, '../../..');          // packages/core/src/__tests__ -> packages/core
const REPO_ROOT = resolve(CORE_DIR, '../..');        // -> repo root

// Directories to exclude
const EXCLUDE_DIRS = new Set<string>([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  '.cache',
  '.tmp',
]);

// Glob-ish path excludes (substring match on normalized posix paths)
const EXCLUDE_PATH_PARTS = [
  '/__tests__/',                 // exclude all tests (including this file)
  '/scripts/codemod/',           // codemods
];

// File extensions we bother scanning
const INCLUDED_EXTS = new Set<string>([
  '.json', '.jsonc', '.ts', '.js', '.mjs', '.cjs', '.yaml', '.yml', '.sh', '.md',
]);

// Regex: match JSON-like key "bundleId": ...
const RE_KEY = /"bundleId"\s*:/;

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    const norm = p.replace(/\\/g, '/');

    // exclude dirs by name
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      // coarse path excludes
      if (EXCLUDE_PATH_PARTS.some((part) => norm.includes(part))) continue;
      walkFiles(p, out);
      continue;
    }

    if (!ent.isFile()) continue;

    // exclude this file explicitly
    if (norm === SELF) continue;
    if (EXCLUDE_PATH_PARTS.some((part) => norm.includes(part))) continue;

    // filter by extension
    const ext = ent.name.slice(ent.name.lastIndexOf('.'));
    if (!INCLUDED_EXTS.has(ext)) continue;

    out.push(p);
  }
  return out;
}

function scanFile(file: string): Hit[] {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (RE_KEY.test(line)) {
      hits.push({ file, line: i + 1, text: line });
    }
  }
  return hits;
}

describe('sanity: no JSON key "bundleId" remains in the repo', () => {
  it('finds zero matches outside excluded directories/files', () => {
    // Guard: repo root is a directory
    expect(statSync(REPO_ROOT).isDirectory()).toBe(true);

    const files = walkFiles(REPO_ROOT);
    const allHits = files.flatMap(scanFile);

    if (allHits.length > 0) {
      const preview = allHits
        .slice(0, 20)
        .map((h) => ` - ${h.file}:${h.line} :: ${h.text.trim()}`)
        .join('\n');
      console.error(`Found forbidden JSON key "bundleId" in:\n${preview}`);
    }

    expect(allHits.length).toBe(0);
  });
});
