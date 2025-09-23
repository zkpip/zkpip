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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..', '..');
// Default vectors root (monorepo layout)
const VECTORS_ROOT = path.join(REPO_ROOT, 'packages/core/schemas/tests/vectors/mvs/verification');
const ENV_ADAPTER = process.env.E2E_ADAPTER; // e.g. "snarkjs-groth16"
const ENV_PROFILE = (process.env.E2E_PROFILE ?? 'core');
const ENV_OUT = process.env.E2E_OUT ?? path.join(CLI_ROOT, 'e2e-artifacts');
const ENV_LIMIT = process.env.E2E_LIMIT ? Number(process.env.E2E_LIMIT) : undefined;
function sha256FileSync(abs) {
    const h = createHash('sha256');
    h.update(fssync.readFileSync(abs));
    return h.digest('hex');
}
function isoNow() {
    return new Date().toISOString();
}
function tryGit(cmd) {
    try {
        const out = cp
            .execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString('utf8')
            .trim();
        return out || undefined;
    }
    catch {
        return undefined;
    }
}
function listDirs(abs) {
    return fssync.existsSync(abs)
        ? fssync
            .readdirSync(abs, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
        : [];
}
function walkJson(root, limit) {
    const out = [];
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        const ents = fssync.readdirSync(dir, { withFileTypes: true });
        for (const ent of ents) {
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                stack.push(p);
            }
            else if (ent.isFile() && p.endsWith('.json')) {
                out.push(p);
                if (typeof limit === 'number' && out.length >= limit)
                    return out.sort();
            }
        }
    }
    return out.sort();
}
function relToVectors(abs) {
    return path.relative(VECTORS_ROOT, abs).replace(/\\/g, '/');
}
function pick(o, paths) {
    for (const p of paths) {
        const v = getPath(o, p);
        if (v !== undefined)
            return v;
    }
    return undefined;
}
function getPath(o, pathStr) {
    if (typeof o !== 'object' || o === null || Array.isArray(o))
        return undefined;
    const parts = pathStr.split('.');
    let cur = o;
    for (const key of parts) {
        if (typeof cur !== 'object' || cur === null || Array.isArray(cur))
            return undefined;
        cur = cur[key];
    }
    return cur;
}
function extractMeta(data) {
    const schemaVersion = pick(data, ['schemaVersion', 'meta.schemaVersion']) ?? undefined;
    const envelopeId = pick(data, ['envelopeId', 'meta.envelopeId']) ?? undefined;
    const proofSystem = pick(data, ['proofSystem', 'meta.proofSystem', 'verifier.proofSystem']) ?? undefined;
    const curve = pick(data, ['curve', 'meta.curve', 'verifier.curve']) ?? undefined;
    const publicSignals = pick(data, [
        'publicSignals',
        'result.publicSignals',
        'bundle.publicSignals',
        'result.bundle.publicSignals',
    ]);
    const pubLen = Array.isArray(publicSignals) ? publicSignals.length : 0;
    const pubFirst = Array.isArray(publicSignals) && publicSignals.length > 0
        ? String(publicSignals[0])
        : undefined;
    return {
        schemaVersion,
        envelopeId,
        proofSystem,
        curve,
        publicSignals: { length: pubLen, first: pubFirst },
    };
}
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
async function main() {
    // Discover adapters under vectors root
    const allAdapters = listDirs(VECTORS_ROOT);
    const chosenAdapters = ENV_ADAPTER ? allAdapters.filter((a) => a === ENV_ADAPTER) : allAdapters;
    // Prepare output folder
    const runId = isoNow()
        .replace(/[:-]/g, '')
        .replace(/\.\d+Z$/, 'Z'); // e.g. 20250908T093012Z
    const OUT_DIR = path.join(ENV_OUT, runId);
    await ensureDir(OUT_DIR);
    // Run info
    const run = {
        startedAt: isoNow(),
        cwd: process.cwd(),
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        e2e: {
            adapter: ENV_ADAPTER,
            profile: ENV_PROFILE,
            limit: ENV_LIMIT,
            outDir: OUT_DIR,
            vectorsRoot: VECTORS_ROOT,
            adapters: chosenAdapters,
        },
        git: {
            head: tryGit('git rev-parse HEAD'),
            branch: tryGit('git rev-parse --abbrev-ref HEAD'),
            statusClean: tryGit('git status --porcelain') === '' ? true : false,
        },
    };
    const indexRows = [];
    const errors = [];
    for (const adapter of chosenAdapters) {
        const base = path.join(VECTORS_ROOT, adapter);
        const sets = [
            { set: 'valid', dir: path.join(base, 'valid') },
            { set: 'invalid', dir: path.join(base, 'invalid') },
        ];
        for (const s of sets) {
            if (!fssync.existsSync(s.dir))
                continue;
            const files = walkJson(s.dir, ENV_LIMIT);
            for (const abs of files) {
                const rel = relToVectors(abs);
                const size = fssync.statSync(abs).size;
                const sha256 = sha256FileSync(abs);
                let parseOk = false;
                let meta;
                let errMsg;
                try {
                    const raw = await fs.readFile(abs, 'utf8');
                    const data = JSON.parse(raw);
                    parseOk = true;
                    meta = extractMeta(data);
                }
                catch (e) {
                    parseOk = false;
                    errMsg = e instanceof Error ? e.message : String(e);
                    errors.push({ path: rel, error: errMsg });
                }
                // ✅ compute kind from REL (not abs), and INSIDE the loop
                const kind = path.basename(rel).includes('.expect.')
                    ? 'expect'
                    : 'bundle';
                indexRows.push({
                    path: rel,
                    adapter,
                    set: s.set,
                    size,
                    sha256,
                    parseOk,
                    meta,
                    error: errMsg,
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
    }
    else {
        await fs.writeFile(path.join(OUT_DIR, 'errors.ndjson'), '');
    }
    // Human-readable summary
    const total = indexRows.length;
    const ok = indexRows.filter((r) => r.parseOk).length;
    const bad = total - ok;
    const perAdapter = [];
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
main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
});
//# sourceMappingURL=e2e-discover.js.map