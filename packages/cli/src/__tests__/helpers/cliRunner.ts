import { execaNode } from 'execa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

export interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function pkgRoot(): string {
  // .../packages/cli/src/__tests__/helpers/cliRunner.ts -> packages/cli
  const here = fileURLToPath(import.meta.url);
  const dir = path.dirname(here); // .../src/__tests__/helpers
  return path.resolve(dir, '..', '..', '..'); // -> packages/cli
}

function repoRoot(): string {
  // .../packages/cli -> repo root (két szinttel feljebb)
  return path.resolve(pkgRoot(), '..', '..');
}

function cliDistEntry(): string {
  return path.resolve(pkgRoot(), 'dist', 'index.js');
}

export function fixturesPath(rel: string): string {
  const candCli = path.resolve(pkgRoot(), 'fixtures', rel);
  if (existsSync(candCli)) return candCli;

  const candRepo = path.resolve(repoRoot(), 'fixtures', rel);
  if (existsSync(candRepo)) return candRepo;

  // fallback (hadd bukjon értelmes ENOENT-tel, de legalább determinisztikusan)
  return candCli;
}

type RunOpts = {
  readonly json?: boolean;
  readonly useExitCodes?: boolean;
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
};

export async function runCli(args: readonly string[], opts: RunOpts = {}): Promise<RunResult> {
  const cli = cliDistEntry();

  const finalArgs: string[] = [...args];
  if (opts.json) finalArgs.push('--json');
  if (opts.useExitCodes) finalArgs.push('--use-exit-codes');

  const env = {
    ...process.env,
    NODE_NO_WARNINGS: '1',
    ...(opts.env ?? {}),
  };

  const { stdout, stderr, exitCode } = await execaNode(cli, finalArgs, {
    reject: false,
    cwd: opts.cwd ?? pkgRoot(), // CLI csomag gyökér mint cwd
    env,
  });

  return { stdout, stderr, exitCode };
}

export function parseJson<T>(s: string): T {
  return JSON.parse(s.trim()) as T;
}
