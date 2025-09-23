// Stage 1 – Abstract e2e runner
// Runs CLI "verify" against discovered bundles and checks exit codes + optional .expect.json subset.
// - English comments
// - No `any`
// - NodeNext compatible (run with: tsx scripts/e2e.ts)

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
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
const VERIFY_BIN = path.join(CLI_ROOT, 'dist', 'index.js');

// ---------- FS helpers ----------
function listDirs(abs: string): string[] {
  return fs.existsSync(abs)
    ? fs
        .readdirSync(abs, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
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

function relToVectors(abs: string): string {
  return path.relative(VECTORS_ROOT, abs).replace(/\\/g, '/');
}

function latestRunDir(root: string): string | undefined {
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => /^\d{8}T\d{6}Z$/.test(n)) // ISO-ish folder name from Stage 0
    .sort();
  return dirs.length ? path.join(root, dirs[dirs.length - 1]) : undefined;
}

async function readJson<T extends JSONObject = JSONObject>(fp: string): Promise<T> {
  const raw = await fsp.readFile(fp, 'utf8');
  return JSON.parse(raw) as T;
}

// ---------- subset matcher (object-only, strict equality for scalars/arrays) ----------
function isObject(x: unknown): x is JSONObject {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function subsetMatch(actual: JSONValue, expect: JSONValue): boolean {
  if (Array.isArray(expect)) {
    // For arrays: require strict deep equality
    return JSON.stringify(actual) === JSON.stringify(expect);
  }
  if (isObject(expect)) {
    if (!isObject(actual)) return false;
    for (const [k, v] of Object.entries(expect)) {
      if (!(k in actual)) return false;
      const a = (actual as JSONObject)[k];
      if (!subsetMatch(a, v)) return false;
    }
    return true;
  }
  // primitives: strict equality
  return actual === expect;
}

// ---------- runner ----------
async function main(): Promise<void> {
  // Discover adapters (directories under vectors root)
  const allAdapters = listDirs(VECTORS_ROOT);
  const adapters = ENV_ADAPTER ? allAdapters.filter((a) => a === ENV_ADAPTER) : allAdapters;

  if (!fs.existsSync(VERIFY_BIN)) {
    throw new Error(
      `CLI binary not found at ${VERIFY_BIN}. Did you run "npm -w @zkpip/cli run build"?`,
    );
  }

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
        const fileRel = relToVectors(abs);

        const args = [
          VERIFY_BIN,
          'verify',
          '--adapter',
          adapter,
          '--envelope',
          abs,
          '--json',
          '--use-exit-codes',
        ];

        const started = Date.now();
        const cp = spawnSync('node', args, { encoding: 'utf8' });
        const timeMs = Date.now() - started;

        let parsed: JSONObject | undefined;
        let parseOk = false;
        if (typeof cp.stdout === 'string' && cp.stdout.trim().length > 0) {
          try {
            parsed = JSON.parse(cp.stdout) as JSONObject;
            parseOk = true;
          } catch {
            parseOk = false;
          }
        }

        // Optional .expect.json beside the bundle
        const expectPath = abs.replace(/\.json$/, '.expect.json');
        let expectMatched: boolean | undefined = undefined;
        if (fs.existsSync(expectPath) && parsed) {
          const expect = await readJson<JSONObject>(expectPath);
          expectMatched = subsetMatch(parsed, expect);
        }

        rows.push({
          adapter,
          set,
          file: fileRel,
          abs,
          exitCode: cp.status ?? 2,
          ok: parseOk ? Boolean(parsed?.ok) : false,
          stdout: parsed,
          stderr: cp.stderr || undefined,
          timeMs,
          expectMatched,
          expectPath: fs.existsSync(expectPath) ? expectPath : undefined,
          error: cp.error ? String(cp.error) : undefined,
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

  const lines: string[] = [];
  lines.push('# Stage 1 – Verify matrix');
  lines.push('');
  lines.push(`- Vectors root: ${VECTORS_ROOT}`);
  lines.push(`- CLI: node ${VERIFY_BIN}`);
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
