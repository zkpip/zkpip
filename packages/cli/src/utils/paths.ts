// ESM-only path helpers for stable, secure file operations.
// - No "any", NodeNext-friendly.
// - Does not require target paths to exist when joining (no realpath on candidate).
// - Provides repoRoot() discovery (walk-up until "packages").
//
// Usage notes:
// - Use joinInside(base, ...segments) when you want to ensure the final path
//   stays under base (no traversal), even if it doesn't exist yet.
// - Call ensureDirExists(dir) BEFORE writing files there.
//
// Security note:
// - We only resolve realpath() on the baseDir (must exist or be creatable).

import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  dirname,
  resolve,
  join,
  normalize,
  sep,
  isAbsolute,
} from 'node:path';
import {
  existsSync,
  mkdirSync,
  realpathSync,
} from 'node:fs';

export interface Paths {
  projectRoot: string;
  tmpDir: string;
}

const here = dirname(fileURLToPath(import.meta.url));

let _repoRoot: string | undefined;

/** Find repo root by walking up until we see a "packages" folder. Memoized. */
export function repoRoot(): string | undefined {
  if (_repoRoot) return _repoRoot;
  let dir = here;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'packages'))) {
      _repoRoot = dir;
      return _repoRoot;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return undefined;
}

/** Like join(), but guarantees the result stays inside baseDir (no traversal). */
export function joinInside(baseDir: string, ...segments: string[]): string {
  // Base must be absolute; resolve and realpath it (handles symlinks).
  const baseAbs = isAbsolute(baseDir) ? baseDir : resolve(process.cwd(), baseDir);
  // Ensure base exists (or create) so realpathSync() can succeed consistently.
  if (!existsSync(baseAbs)) mkdirSync(baseAbs, { recursive: true });
  const baseReal = realpathSync(baseAbs);

  // Join + normalize the candidate without requiring it to exist.
  const candidate = normalize(resolve(baseReal, ...segments));

  // Ensure candidate stays under baseReal (directory boundary safe).
  // Add trailing separator to avoid prefix tricks (e.g., /tmp/a vs /tmp/ab).
  const baseWithSep = baseReal.endsWith(sep) ? baseReal : baseReal + sep;
  if (!(candidate === baseReal || candidate.startsWith(baseWithSep))) {
    throw new Error(`Refusing path traversal outside baseDir: ${candidate}`);
  }
  return candidate;
}

/** Return a couple of canonical project paths. */
export function mkPaths(): Paths {
  const root = repoRoot() ?? resolve(here, '../../..'); // fallback if walk-up fails
  const tmp = joinInside(root, '.tmp'); // ensure exists
  return {
    projectRoot: root,
    tmpDir: tmp,
  };
}

/** Resolve a path relative to this file (rarely needed). */
export function fromHere(...p: string[]): string {
  return resolve(here, ...p);
}

/** Ensure directory exists recursively (idempotent). */
export function ensureDirExists(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Turn a filesystem path into a file:// URL string. */
export function toFileUrl(p: string): string {
  return String(pathToFileURL(p));
}

/** Repo-relative join (returns undefined if repo root not found). */
export function repoJoin(...segments: string[]): string | undefined {
  const root = repoRoot();
  return root ? resolve(root, ...segments) : undefined;
}
