// ESM, strict TS, no "any". Robust CLI runner for tests.
// - Resolves the CLI binary even if Vitest runs from different cwd
// - Ensures --json and --use-exit-codes unless disabled
// - Throws helpful error on empty stdout (includes stderr)

import { execaNode } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

export interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /** Add --json (default: true) */
  readonly ensureJson?: boolean;
  /** Add --use-exit-codes (default: true) */
  readonly ensureExitCodes?: boolean;
  /** Override CLI binary path if needed */
  readonly binOverride?: string;
}

/** packages/cli absolute path based on this helper location */
function pkgRoot(): string {
  // typical location: .../packages/cli/src/__tests__/helpers/cliRunner.ts
  const here = fileURLToPath(import.meta.url);
  const testsDir = dirname(here); // .../src/__tests__/helpers
  const srcDir = resolve(testsDir, '..', '..'); // .../src
  const pkgDir = resolve(srcDir, '..'); // .../packages/cli
  return pkgDir;
}

function resolveBinPath(): string {
  const candidates: readonly string[] = [
    // inside the CLI package (most common)
    join(pkgRoot(), 'dist', 'index.js'),

    // relative to this file URL (works if layout changes slightly)
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'dist', 'index.js'),

    // repo-root style fallback: <repo>/packages/cli/dist/index.js
    resolve(pkgRoot(), 'dist', 'index.js'),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`CLI binary not found. Tried: ${candidates.join(', ')}`);
}

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

function ensureFlags(
  args: readonly string[],
  opts: { readonly json: boolean; readonly exitCodes: boolean },
): readonly string[] {
  const out: string[] = [...args];
  if (opts.json && !hasFlag(out, '--json')) out.push('--json');
  if (opts.exitCodes && !hasFlag(out, '--use-exit-codes')) out.push('--use-exit-codes');
  return out;
}

/** Single entry-point: run the CLI with robust defaults. */
export async function runCli(args: readonly string[], options?: RunOptions): Promise<RunResult> {
  const bin = options?.binOverride?.trim() || resolveBinPath();

  const finalArgs = ensureFlags(args, {
    json: options?.ensureJson !== false,
    exitCodes: options?.ensureExitCodes !== false,
  });

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(options?.env ?? {}),
  };

  const { stdout, stderr, exitCode } = await execaNode(bin, finalArgs, {
    reject: false,
    cwd: options?.cwd ?? pkgRoot(),
    env,
  });

  return { stdout, stderr, exitCode };
}

/** Convenience for verify subcommand. */
export async function runVerify(
  adapter: string,
  verificationPath: string,
  extra: readonly string[] = [],
  options?: RunOptions,
): Promise<RunResult> {
  const args = ['verify', '--adapter', adapter, '--verification', verificationPath, ...extra];
  return runCli(args, options);
}

/** Safe JSON.parse with stderr fallback on errors.
 *  - Success paths print JSON to stdout.
 *  - Error paths in our CLI print JSON to stderr.
 */
export function parseJson<T>(stdout: string, stderr: string): T {
  const s = (stdout ?? '').trim();
  if (s.length > 0) {
    return JSON.parse(s) as T;
  }

  const e = (stderr ?? '').trim();
  if (e.length > 0) {
    // Only parse if it *looks* like JSON (avoids parsing stack traces)
    const firstChar = e[0];
    if (firstChar === '{' || firstChar === '[') {
      return JSON.parse(e) as T;
    }
  }

  throw new Error(
    `No JSON found in stdout/stderr.
stdout: ${JSON.stringify(s)}
stderr: ${JSON.stringify(e)}`,
  );
}

/** Resolve the absolute path of a fixture file in a robust way.
 * Tries, in order:
 *  1) <current process cwd>/fixtures/...
 *  2) <packages/cli>/../../fixtures/...         (repo root fixtures)
 *  3) <packages/cli>/fixtures/...
 * Returns the first existing candidate; if none exists, returns the #1 candidate (absolute).
 */
export function fixturesPath(...segments: string[]): string {
  const pkgDir = pkgRoot();
  const candidates: readonly string[] = [
    resolve(process.cwd(), 'fixtures', ...segments),
    resolve(pkgDir, '..', '..', 'fixtures', ...segments),
    resolve(pkgDir, 'fixtures', ...segments),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Fallback: return the first candidate (absolute), so errors show a meaningful path
  return candidates[0]!;
}

/** Exported for rare cases when tests need the resolved paths. */
export const paths = {
  pkgRoot,
  resolveBinPath,
};
