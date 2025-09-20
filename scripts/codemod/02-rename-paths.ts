// ESM, strict TS. Run with: node --loader tsx scripts/codemod/02-rename-paths.ts
// Purpose: rename any path segments containing proof-bundle/ProofBundle -> proof-envelope/ProofEnvelope.

import { readdirSync, renameSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';

const ROOT = resolve(process.cwd());
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', '.cache']);

const DRY_RUN = process.env.DRY_RUN === '1';

function shouldSkipDir(name: string): boolean {
  return EXCLUDE_DIRS.has(name);
}

function nextName(name: string): string {
  let out = name;
  out = out.replace(/ProofBundle/g, 'ProofEnvelope');
  out = out.replace(/proof-bundle/g, 'proof-envelope');
  return out;
}

function walkAndRename(dir: string): void {
  // Depth-first to avoid renaming parent before children
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!shouldSkipDir(entry)) {
        walkAndRename(full);
        // after visiting children, maybe rename the directory itself
        const newBase = nextName(basename(full));
        if (newBase !== basename(full)) {
          const target = join(dirname(full), newBase);
          console.log(`${DRY_RUN ? '[DRY] ' : ''}mv dir: ${full} -> ${target}`);
          if (!DRY_RUN) renameSync(full, target);
        }
      }
    } else {
      // files
      const newBase = nextName(basename(full));
      if (newBase !== basename(full)) {
        const target = join(dirname(full), newBase);
        console.log(`${DRY_RUN ? '[DRY] ' : ''}mv file: ${full} -> ${target}`);
        if (!DRY_RUN) renameSync(full, target);
      }
    }
  }
}

walkAndRename(ROOT);
console.log(`${DRY_RUN ? '[DRY] ' : ''}path rename done.`);
