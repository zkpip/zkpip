// ESM-only; no "any"; recompute sha256/size directly from verification.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { jcsCanonicalize, assertJson, loadJson } from './jcs.js';

type HashIndexEntry = { path: string; sha256: string; size: number };
type HashIndex = Record<string, HashIndexEntry>;

type Manifest = {
  version: '1';
  id: string; // can:<framework>:<proofSystem>:<suite>:<validity>
  framework: string;
  proofSystem: 'groth16' | 'plonk';
  urls: readonly string[];
  sha256: string;
  size: number;
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

import { createHash } from 'node:crypto';
function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
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

async function main(): Promise<void> {
  // Args: --index <hash-index.json> --outdir <dir> --kid <id> [--base <https://...>]
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
  let dirty = false; // track whether we changed the index

  const idxAbs = absFromRoot(root, idxPath);
  const index = JSON.parse(await fs.readFile(idxAbs, 'utf8')) as HashIndex;

  await fs.mkdir(absFromRoot(root, outDir), { recursive: true });

  for (const [id, info] of Object.entries(index)) {
    const { framework, proofSystem } = parseId(id);

    // Recompute from the actual verification.json on disk
    const verAbs = absFromRoot(root, info.path);
    const payloadUnknown = await loadJson(verAbs); //: unknown
    assertJson(payloadUnknown, 'payload');
    const payload = payloadUnknown; //: Json
    const canonical = jcsCanonicalize(payload);

    const digest = sha256Hex(canonical);
    const size = Buffer.byteLength(canonical, 'utf8');

    // Optional: warn if hash-index is stale
    if (checkIndex && info.sha256 && info.sha256 !== digest) {
      console.warn(`⚠️  hash-index sha256 differs for ${id}: index=${info.sha256} calc=${digest}`);
    }
    if (updateIndex && info.sha256 !== digest) {
      index[id] = { path: info.path, sha256: digest, size };
      dirty = true;
    }

    if (checkIndex && typeof info.size === 'number' && info.size !== size) {
      console.warn(`⚠️  hash-index size differs for ${id}: index=${info.size} calc=${size}`);
    }
    if (updateIndex && info.size !== size) {
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
    await fs.writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`manifest: ${path.join(outDir, fname)}`);
  }

  // Persist updated index if requested
  if (updateIndex && dirty) {
    await fs.writeFile(idxAbs, JSON.stringify(index, null, 2) + '\n', 'utf8');
    console.log(`index updated → ${path.relative(root, idxAbs)}`);
  }
}

await main();
