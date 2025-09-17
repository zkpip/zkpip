// scripts/spec/make-manifests.ts
// ESM-only; strict TS; no "any".
// Recompute sha256/size from canonical (JCS) BYTES; idempotent write + dry-run/fail-on-change.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { jcsCanonicalize, assertJson, loadJson } from './jcs.js';

type HashIndexEntry = { path: string; sha256: string; size: number };
type HashIndex = Record<string, HashIndexEntry>;

type Manifest = {
  version: '1';
  id: string;
  framework: string;
  proofSystem: 'groth16' | 'plonk';
  urls: readonly string[];
  sha256: string; // hex over JCS(verification.json) BYTES
  size: number; // byte length of JCS(verification.json)
  meta?: Record<string, string>;
  kid: string;
};

function base64url(s: string): string {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
function sha256HexBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function normalizeRelPath(rel: string): string {
  const trimmed = rel
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^\.\//, '');
  return path.normalize(trimmed);
}
function absFromRoot(root: string, rel: string): string {
  const norm = normalizeRelPath(rel);
  return path.isAbsolute(norm) ? norm : path.join(root, norm);
}
function parseId(id: string): {
  framework: string;
  proofSystem: 'groth16' | 'plonk';
  suite: string;
  validity: 'valid' | 'invalid';
} {
  const parts = id.split(':');
  if (parts.length !== 5 || parts[0] !== 'can') throw new Error(`Invalid Vector ID: ${id}`);
  const [, framework, proofSystem, suite, validity] = parts;
  if (proofSystem !== 'groth16' && proofSystem !== 'plonk')
    throw new Error(`Unsupported proofSystem in ${id}`);
  if (validity !== 'valid' && validity !== 'invalid')
    throw new Error(`Unsupported validity in ${id}`);
  return { framework, proofSystem, suite, validity };
}

async function main(): Promise<void> {
  // Args: --index <hash-index.json> --outdir <dir> --kid <id> [--base <https://...>] [--dry-run 0|1] [--fail-on-change 0|1] [--check-index 0|1] [--update-index 0|1]
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }

  const root = process.cwd();
  const idxPath = args.get('index') ?? 'docs/spec/hash-index.json';
  const outDir = args.get('outdir') ?? 'docs/spec/examples/canvectors';
  const kid = args.get('kid') ?? 'dev-1';
  const base = args.get('base'); // optional http(s) base

  const checkIndex = (args.get('check-index') ?? '0') !== '0';
  const updateIndex = (args.get('update-index') ?? '0') !== '0';
  const dryRun = (args.get('dry-run') ?? '0') !== '0';
  const failOnChange = (args.get('fail-on-change') ?? '0') !== '0';

  const idxAbs = absFromRoot(root, idxPath);
  const index = JSON.parse(await fs.readFile(idxAbs, 'utf8')) as HashIndex;

  await fs.mkdir(absFromRoot(root, outDir), { recursive: true });

  let wouldChange = 0;
  let dirty = false;

  for (const [id, info] of Object.entries(index)) {
    const { framework, proofSystem } = parseId(id);

    // Recompute JCS bytes from verification.json
    const verAbs = absFromRoot(root, info.path);
    const payloadUnknown = await loadJson(verAbs);
    assertJson(payloadUnknown, 'payload');
    const canonicalBytes = jcsCanonicalize(payloadUnknown);
    const digest = sha256HexBytes(canonicalBytes);
    const size = canonicalBytes.length;

    if (checkIndex && info.sha256 && info.sha256 !== digest) {
      console.warn(`⚠️  hash-index sha256 differs for ${id}: index=${info.sha256} calc=${digest}`);
    }
    if (checkIndex && typeof info.size === 'number' && info.size !== size) {
      console.warn(`⚠️  hash-index size differs for ${id}: index=${info.size} calc=${size}`);
    }
    if (updateIndex && (info.sha256 !== digest || info.size !== size)) {
      index[id] = { path: info.path, sha256: digest, size };
      dirty = true;
    }

    const url = base
      ? `${base.replace(/\/+$/, '')}/by-id/${base64url(id)}/verification.json`
      : `file://${verAbs}`;

    const manifest: Manifest = {
      version: '1',
      id,
      framework,
      proofSystem,
      urls: [url],
      sha256: digest,
      size,
      meta: { sourcePath: info.path },
      kid,
    };

    const fname = `can-${framework}-${proofSystem}-${base64url(id)}.manifest.json`;
    const outPath = absFromRoot(root, path.join(outDir, fname));

    // Idempotent write: compute canonical BYTES of would-be JSON and compare with existing file bytes
    const nextText = JSON.stringify(manifest, null, 2) + '\n';

    let needWrite = true;
    try {
      const prevText = await fs.readFile(outPath, 'utf8');
      if (prevText === nextText) needWrite = false;
    } catch {
      /* file missing → write */
    }

    if (needWrite) {
      wouldChange++;
      if (!dryRun) {
        await fs.writeFile(outPath, nextText, 'utf8');
        console.log(`manifest: ${path.join(outDir, fname)} (updated)`);
      } else {
        console.log(`manifest (dry-run change): ${path.join(outDir, fname)}`);
      }
    } else {
      console.log(`manifest: ${path.join(outDir, fname)} (unchanged)`);
    }
  }

  if (updateIndex && dirty) {
    if (!dryRun) {
      await fs.writeFile(idxAbs, JSON.stringify(index, null, 2) + '\n', 'utf8');
      console.log(`index updated → ${path.relative(root, idxAbs)}`);
    } else {
      console.log(`index (dry-run change): ${path.relative(root, idxAbs)}`);
      wouldChange++;
    }
  }

  if (failOnChange && wouldChange > 0) {
    console.error(`\n❌ Would change ${wouldChange} file(s) (use --dry-run 0 to write).`);
    process.exit(1);
  }
}

await main();
