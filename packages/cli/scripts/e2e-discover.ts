// Stage 0 – Discover & Load
// Scans vector JSONs, computes sha256/size, extracts light bundle meta,
// and writes deterministic artifacts: run.json, index.json, errors.ndjson, summary.md
// - English comments
// - No `any`
// - NodeNext compatible (run with: tsx packages/cli/scripts/e2e-discover.ts)

import { promises as fs } from 'node:fs';
import * as fssync from 'node:fs';
import * as os from 'node:os';
import * as cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONArray = ReadonlyArray<JSONValue>;
type JSONObject = { readonly [k: string]: JSONValue };

type EntryMeta = Readonly<{
  schemaVersion?: string;
  envelopeId?: string;
  proofSystem?: string;
  curve?: string;
  publicSignals?: Readonly<{
    length: number;
    first?: string;
  }>;
}>;

type IndexRow = Readonly<{
  path: string; // relative to VECTORS_ROOT
  adapter?: string; // adapter folder if any
  set?: 'valid' | 'invalid' | 'other';
  size: number;
  sha256: string;
  parseOk: boolean;
  meta?: EntryMeta;
  error?: string; // parse error only
  kind: 'bundle' | 'expect';
}>;

type RunInfo = Readonly<{
  startedAt: string;
  cwd: string;
  node: string;
  platform: string;
  arch: string;
  release: string;
  e2e: Readonly<{
    adapter?: string;
    profile: 'core' | 'debug' | 'deep';
    limit?: number;
    outDir: string;
    vectorsRoot: string;
    adapters: readonly string[];
  }>;
  git?: Readonly<{
    head?: string;
    branch?: string;
    statusClean?: boolean;
  }>;
}>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..', '..');

// Default vectors root (monorepo layout)
const VECTORS_ROOT = path.join(REPO_ROOT, 'packages/core/schemas/tests/vectors/mvs/verification');

const ENV_ADAPTER = process.env.E2E_ADAPTER; // e.g. "snarkjs-groth16"
const ENV_PROFILE = (process.env.E2E_PROFILE ?? 'core') as 'core' | 'debug' | 'deep';
const ENV_OUT = process.env.E2E_OUT ?? path.join(CLI_ROOT, 'e2e-artifacts');
const ENV_LIMIT = process.env.E2E_LIMIT ? Number(process.env.E2E_LIMIT) : undefined;

function sha256FileSync(abs: string): string {
  const h = createHash('sha256');
  h.update(fssync.readFileSync(abs));
  return h.digest('hex');
}

function isoNow(): string {
  return new Date().toISOString();
}

function tryGit(cmd: string): string | undefined {
  try {
    const out = cp
      .execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

function listDirs(abs: string): string[] {
  return fssync.existsSync(abs)
    ? fssync
        .readdirSync(abs, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
}

function walkJson(root: string, limit?: number): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    const ents = fssync.readdirSync(dir, { withFileTypes: true });
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(p);
      } else if (ent.isFile() && p.endsWith('.json')) {
        out.push(p);
        if (typeof limit === 'number' && out.length >= limit) return out.sort();
      }
    }
  }
  return out.sort();
}

function relToVectors(abs: string): string {
  return path.relative(VECTORS_ROOT, abs).replace(/\\/g, '/');
}

function pick<T extends JSONValue = JSONValue>(
  o: unknown,
  paths: readonly string[],
): T | undefined {
  for (const p of paths) {
    const v = getPath<T>(o, p);
    if (v !== undefined) return v;
  }
  return undefined;
}

function getPath<T extends JSONValue = JSONValue>(o: unknown, pathStr: string): T | undefined {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return undefined;
  const parts = pathStr.split('.');
  let cur: unknown = o;
  for (const key of parts) {
    if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return undefined;
    cur = (cur as JSONObject)[key];
  }
  return cur as T | undefined;
}

function extractMeta(data: unknown): EntryMeta {
  const schemaVersion = pick<string>(data, ['schemaVersion', 'meta.schemaVersion']) ?? undefined;
  const envelopeId = pick<string>(data, ['envelopeId', 'meta.envelopeId']) ?? undefined;
  const proofSystem =
    pick<string>(data, ['proofSystem', 'meta.proofSystem', 'verifier.proofSystem']) ?? undefined;
  const curve = pick<string>(data, ['curve', 'meta.curve', 'verifier.curve']) ?? undefined;

  const publicSignals = pick<JSONArray>(data, [
    'publicSignals',
    'result.publicSignals',
    'bundle.publicSignals',
    'result.bundle.publicSignals',
  ]);
  const pubLen = Array.isArray(publicSignals) ? publicSignals.length : 0;
  const pubFirst =
    Array.isArray(publicSignals) && publicSignals.length > 0
      ? String(publicSignals[0] as JSONPrimitive)
      : undefined;

  const base: EntryMeta = {
    publicSignals: pubFirst !== undefined
      ? { length: pubLen, first: pubFirst }
      : { length: pubLen },
  };

  return {
    ...base,
    ...(schemaVersion !== undefined ? { schemaVersion } : {}),
    ...(envelopeId   !== undefined ? { envelopeId }   : {}),
    ...(proofSystem  !== undefined ? { proofSystem }  : {}),
    ...(curve        !== undefined ? { curve }        : {}),
  };
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function main(): Promise<void> {
  // Discover adapters under vectors root
  const allAdapters = listDirs(VECTORS_ROOT);
  const chosenAdapters = ENV_ADAPTER ? allAdapters.filter((a) => a === ENV_ADAPTER) : allAdapters;

  // Prepare output folder
  const runId = isoNow()
    .replace(/[:-]/g, '')
    .replace(/\.\d+Z$/, 'Z'); // e.g. 20250908T093012Z
  const OUT_DIR = path.join(ENV_OUT, runId);
  await ensureDir(OUT_DIR);

  const gitHead = tryGit('git rev-parse HEAD');
  const gitBranch = tryGit('git rev-parse --abbrev-ref HEAD');
  const gitStatusClean = tryGit('git status --porcelain') === '' ? true : false;

  // Run info
  const run: RunInfo = {
    startedAt: isoNow(),
    cwd: process.cwd(),
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    e2e: {
      profile: ENV_PROFILE,
      outDir: OUT_DIR,
      vectorsRoot: VECTORS_ROOT,
      adapters: chosenAdapters,
      ...(ENV_ADAPTER !== undefined ? { adapter: ENV_ADAPTER } : {}),
      ...(ENV_LIMIT !== undefined ? { limit: ENV_LIMIT } : {}),
    },
    git: {
      ...(gitHead !== undefined ? { head: gitHead } : {}),
      ...(gitBranch !== undefined ? { branch: gitBranch } : {}),
      statusClean: gitStatusClean,
    },
  };

  const indexRows: IndexRow[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const adapter of chosenAdapters) {
    const base = path.join(VECTORS_ROOT, adapter);
    const sets: ReadonlyArray<{ set: 'valid' | 'invalid'; dir: string }> = [
      { set: 'valid', dir: path.join(base, 'valid') },
      { set: 'invalid', dir: path.join(base, 'invalid') },
    ];

    for (const s of sets) {
      if (!fssync.existsSync(s.dir)) continue;
      const files = walkJson(s.dir, ENV_LIMIT);
      for (const abs of files) {
        const rel = relToVectors(abs);
        const size = fssync.statSync(abs).size;
        const sha256 = sha256FileSync(abs);

        let parseOk = false;
        let meta: EntryMeta | undefined;
        let errMsg: string | undefined;

        try {
          const raw = await fs.readFile(abs, 'utf8');
          const data: unknown = JSON.parse(raw) as unknown;
          parseOk = true;
          meta = extractMeta(data);
        } catch (e: unknown) {
          parseOk = false;
          errMsg = e instanceof Error ? e.message : String(e);
          errors.push({ path: rel, error: errMsg });
        }

        // ✅ compute kind from REL (not abs), and INSIDE the loop
        const kind: 'bundle' | 'expect' = path.basename(rel).includes('.expect.')
          ? 'expect'
          : 'bundle';

        indexRows.push({
          path: rel,
          adapter,
          set: s.set,
          size,
          sha256,
          parseOk,
          ...(meta !== undefined ? { meta } : {}),
          ...(errMsg !== undefined ? { error: errMsg } : {}),
          kind,
        });
      }
    }
  }

  // Write artifacts
  await fs.writeFile(path.join(OUT_DIR, 'run.json'), JSON.stringify(run, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexRows, null, 2));

  if (errors.length > 0) {
    const nd = errors.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await fs.writeFile(path.join(OUT_DIR, 'errors.ndjson'), nd);
  } else {
    await fs.writeFile(path.join(OUT_DIR, 'errors.ndjson'), '');
  }

  // Human-readable summary
  const total = indexRows.length;
  const ok = indexRows.filter((r) => r.parseOk).length;
  const bad = total - ok;
  const perAdapter: string[] = [];
  for (const a of chosenAdapters) {
    const rows = indexRows.filter((r) => r.adapter === a);
    const v = rows.filter((r) => r.set === 'valid').length;
    const iv = rows.filter((r) => r.set === 'invalid').length;
    perAdapter.push(`- ${a}: ${v} valid, ${iv} invalid`);
  }
  const summary = [
    `# Stage 0 – Discover & Load`,
    ``,
    `- Started: ${run.startedAt}`,
    `- Node: ${run.node} (${run.platform} ${run.arch})`,
    `- Profile: ${run.e2e.profile}`,
    `- Vectors root: ${run.e2e.vectorsRoot}`,
    `- Adapters: ${chosenAdapters.length ? chosenAdapters.join(', ') : '(none)'}`,
    ``,
    `## Totals`,
    `- Files: ${total}`,
    `- Parsed OK: ${ok}`,
    `- Parse errors: ${bad}`,
    ``,
    `## Per-adapter`,
    ...perAdapter,
    ``,
  ].join('\n');

  await fs.writeFile(path.join(OUT_DIR, 'summary.md'), summary);
  process.stdout.write(`Stage 0 artifacts → ${OUT_DIR}\n`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
});
