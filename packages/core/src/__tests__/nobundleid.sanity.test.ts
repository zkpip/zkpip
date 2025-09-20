// packages/core/src/__tests__/nobundleid.sanity.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Match = { file: string; line: number; column: number; snippet: string };

const EXCLUDED_DIRS = new Set<string>(['node_modules', 'dist', 'build', '.git']);

// exclude this test file itself (to avoid self-matching)
function isExcludedFile(pathAbs: string): boolean {
  const base = basename(pathAbs);
  return base === 'nobundleid.sanity.test.ts';
}

/** Best-effort: find repo root by walking up until we see a "packages" dir. */
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    const maybePackages = resolve(dir, 'packages');
    if (existsSync(maybePackages)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function pathSep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

/** Decide if a directory should be skipped entirely. */
function isExcludedDir(pathAbs: string): boolean {
  const parts = pathAbs.split(/[/\\]/);
  for (const seg of parts) {
    if (EXCLUDED_DIRS.has(seg)) return true;
  }
  if (
    pathAbs.includes(`${join('scripts', 'codemod')}${pathSep()}`) ||
    pathAbs.endsWith(join('scripts', 'codemod'))
  ) {
    return true;
  }
  return false;
}

/** Quick heuristic to avoid reading obvious binary files. */
function isLikelyTextFile(file: string): boolean {
  const lower = file.toLowerCase();
  const okExts = [
    '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml',
    '.sh', '.txt', '.css', '.html',
  ];
  return okExts.some((ext) => lower.endsWith(ext));
}

/** Recursively scan for lines containing the forbidden token with word boundaries. */
function scanForBundleId(root: string): Match[] {
  const matches: Match[] = [];

  function walk(dir: string): void {
    if (isExcludedDir(dir)) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(p);
      } else if (st.isFile() && isLikelyTextFile(p) && !isExcludedFile(p)) {
        let txt: string;
        try {
          txt = readFileSync(p, 'utf8');
        } catch {
          continue;
        }
        const re = /\bbundleId\b/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(txt)) !== null) {
          const upTo = txt.slice(0, m.index);
          const line = upTo.split(/\r?\n/).length;
          const lineStart = upTo.lastIndexOf('\n') + 1;
          const col = m.index - lineStart + 1;
          const lineText = txt.split(/\r?\n/)[line - 1] ?? '';
          const snippet = lineText.length > 200 ? `${lineText.slice(0, 200)}…` : lineText;
          matches.push({ file: p, line, column: col, snippet });
        }
      }
    }
  }

  walk(root);
  return matches;
}

describe('sanity: no "bundleId" occurrences remain', () => {
  it('finds zero matches outside excluded directories', () => {
    const pkgDir = resolve(__dirname, '..', '..'); // packages/core
    const repoRoot = findRepoRoot(pkgDir);
    const allMatches = [...scanForBundleId(repoRoot), ...scanForBundleId(pkgDir)];

    if (allMatches.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'Found forbidden "bundleId" occurrences:\n' +
          allMatches.map((m) => ` - ${m.file}:${m.line}:${m.column} :: ${m.snippet}`).join('\n'),
      );
    }
    expect(allMatches.length).toBe(0);
  });
});
