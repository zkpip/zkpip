// Stage 1 – Abstract e2e runner
// Runs CLI "verify" against discovered bundles and checks exit codes + optional .expect.json subset.
// - English comments
// - No `any`
// - NodeNext compatible (run with: tsx scripts/e2e.ts)

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { existsSync, promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from '#fs-compat';

// ---------- JSON types (immutable) ----------
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONArray = ReadonlyArray<JSONValue>;
type JSONObject = { readonly [k: string]: JSONValue };

// ---------- Result row ----------
type VerifyRow = Readonly<{
  adapter: string;
  set: 'valid' | 'invalid';
  file: string; // relative to vectorsRoot
  abs: string; // absolute path
  exitCode: number; // 0/1/2
  ok: boolean; // parsed from stdout JSON; false on parse error
  stdout?: JSONObject; // parsed JSON output (if any)
  stderr?: string; // textual stderr
  timeMs: number;
  expectMatched?: boolean; // subset match against .expect.json
  expectPath?: string;
  error?: string; // runner-level error
}>;

// ---------- Env / layout ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..', '..');

const VECTORS_ROOT = path.join(REPO_ROOT, 'packages/core/schemas/tests/vectors/mvs/verification');
const ART_ROOT = path.join(CLI_ROOT, 'e2e-artifacts');

const ENV_ADAPTER = process.env.E2E_ADAPTER; // optional adapter filter

// ---------- FS helpers ----------
function listDirs(abs: string): string[] {
  return fs.existsSync(abs)
    ? fs
        .readdirSync(abs, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
}

export async function runNode(
  cmd: string,
  args: readonly string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  timeMs: number;
  error?: unknown;
}> {
  const started = Date.now();
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  let error: unknown;

  child.stdout.setEncoding('utf8').on('data', (d) => (stdout += String(d)));
  child.stderr.setEncoding('utf8').on('data', (d) => (stderr += String(d)));
  child.on('error', (e) => (error = e));

  const exitCode: number = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
  });

  return {
    exitCode,
    stdout,
    stderr,
    timeMs: Date.now() - started,
    ...(error ? { error } : {}),
  };
}

function walkBundles(dir: string): string[] {
  // Only pick real test inputs (exclude *.expect.json)
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of ents) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith('.json')) continue;
    if (ent.name.includes('.expect.')) continue;
    out.push(path.join(dir, ent.name));
  }
  return out.sort();
}

function resolveCliCommand(): { cmd: string; args: string[] } {
  const ROOT = path.resolve(__dirname, '..'); // packages/cli
  const dist = path.join(ROOT, 'dist', 'index.js');
  const srcTs = path.join(ROOT, 'src', 'index.ts');

  if (existsSync(dist)) {
    // használjuk a felépített JS-t
    return { cmd: process.execPath, args: ['--conditions', 'node', dist] };
  }

  // fallback: futtasd a TS forrást tsx-szel (nem kell build)
  return { cmd: 'npx', args: ['-y', 'tsx', srcTs] };
}

function latestRunDir(root: string): string | undefined {
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => /^\d{8}T\d{6}Z$/.test(n)) // ISO-ish folder name from Stage 0
    .sort();
  if (dirs.length === 0) return undefined;
  return path.join(root, dirs[dirs.length - 1]!);
}

function safeParseJson(s: unknown): JSONObject | undefined {
  if (typeof s !== 'string') return undefined;
  try {
    const v = JSON.parse(s);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? (v as JSONObject) : undefined;
  } catch {
    return undefined;
  }
}

// ---------- runner ----------
async function main(): Promise<void> {
  // Discover adapters (directories under vectors root)
  const allAdapters = listDirs(VECTORS_ROOT);
  const adapters = ENV_ADAPTER ? allAdapters.filter((a) => a === ENV_ADAPTER) : allAdapters;

  const cliCmd = resolveCliCommand();

  // Output dir: reuse the latest Stage 0 run folder (append Stage 1 files)
  const runDir = latestRunDir(ART_ROOT) ?? path.join(ART_ROOT, 'standalone');
  await fsp.mkdir(runDir, { recursive: true });

  const rows: VerifyRow[] = [];

  for (const adapter of adapters) {
    const base = path.join(VECTORS_ROOT, adapter);
    for (const set of ['valid', 'invalid'] as const) {
      const dir = path.join(base, set);
      const bundles = walkBundles(dir);

      for (const abs of bundles) {
        const started = Date.now();

        const args = [
          ...cliCmd.args,
          'verify',
          '--use-exit-codes',
          '--in', abs,
          '--adapter', adapter,
        ];

        const proc = await runNode(cliCmd.cmd, args, {
          cwd: REPO_ROOT, 
        });

        const timeMs = Date.now() - started; 

        const file = path.basename(abs);
        const exitCode = proc.exitCode;
        const ok = exitCode === 0;

        const stdoutObj = safeParseJson(proc.stdout);
        const stderrStr = proc.stderr?.trim() ? proc.stderr : undefined;

        rows.push({
          adapter,
          set,
          file,
          abs,
          exitCode,
          ok,
          timeMs,
          ...(stdoutObj !== undefined ? { stdout: stdoutObj } : {}),
          ...(stderrStr !== undefined ? { stderr: stderrStr } : {}),
          ...(proc.error ? { error: String(proc.error) } : {}),
        });
      }
    }
  }

  // Write artifacts
  const nd = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await writeFile(path.join(runDir, 'verify.ndjson'), nd, 'utf8');

  // Build summary (bundle-only counts by set, and expect coverage)
  const bundlesTotal = rows.length;
  const validBundles = rows.filter((r) => r.set === 'valid').length;
  const invalidBundles = rows.filter((r) => r.set === 'invalid').length;

  const exit0 = rows.filter((r) => r.exitCode === 0).length;
  const exit1 = rows.filter((r) => r.exitCode === 1).length;
  const exitOther = rows.filter((r) => r.exitCode !== 0 && r.exitCode !== 1).length;

  const expectFiles = rows.filter((r) => r.expectPath).length;
  const expectOk = rows.filter((r) => r.expectMatched === true).length;
  const expectFail = rows.filter((r) => r.expectMatched === false).length;

  const cmdPretty = `${cliCmd.cmd} ${cliCmd.args.join(' ')}`;
  const lines: string[] = [];
  lines.push('# Stage 1 – Verify matrix');
  lines.push('');
  lines.push(`- Vectors root: ${VECTORS_ROOT}`);
  lines.push(`- CLI: ${cmdPretty}`);
  lines.push('');
  lines.push('## Totals');
  lines.push(`- Bundles: ${bundlesTotal} (valid: ${validBundles}, invalid: ${invalidBundles})`);
  lines.push(`- Exit codes: 0=${exit0}, 1=${exit1}, other=${exitOther}`);
  lines.push(`- Expect files: ${expectFiles} (ok: ${expectOk}, fail: ${expectFail})`);
  lines.push('');
  lines.push('## Per-adapter');
  for (const a of adapters) {
    const ar = rows.filter((r) => r.adapter === a);
    const v = ar.filter((r) => r.set === 'valid').length;
    const iv = ar.filter((r) => r.set === 'invalid').length;
    const ok0 = ar.filter((r) => r.exitCode === 0).length;
    const ok1 = ar.filter((r) => r.exitCode === 1).length;
    const o = ar.filter((r) => r.exitCode !== 0 && r.exitCode !== 1).length;
    lines.push(`- ${a}: valid=${v}, invalid=${iv} | exit0=${ok0}, exit1=${ok1}, other=${o}`);
  }
  lines.push('');
  await writeFile(path.join(runDir, 'stage1-summary.md'), lines.join('\n'), 'utf8');

  process.stdout.write(`Stage 1 results → ${path.join(runDir, 'verify.ndjson')}\n`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
});
