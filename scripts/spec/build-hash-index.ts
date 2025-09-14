// ESM-only; no "any"; English comments
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

type VectorIdMap = Record<string, string>;

type HashIndexEntry = {
  path: string; // relative path to the verification.json
  sha256: string; // hex digest of the JCS-canonicalized payload
  size: number; // byte length of the JCS-canonicalized payload
};

type HashIndex = Record<string, HashIndexEntry>;

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

function jcsCanonicalize(value: Json): string {
  // Minimal RFC8785-like canonicalization:
  // - Objects: keys sorted lexicographically
  // - Arrays: element order preserved
  // - Primitives: JSON.stringify
  if (Array.isArray(value)) {
    return `[${value.map(jcsCanonicalize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as { [k: string]: Json };
    const entries = Object.keys(obj)
      .sort()
      .map((k) => `"${k}":${jcsCanonicalize(obj[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

async function loadJson<T extends Json>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function toAbs(root: string, rel: string): string {
  return path.isAbsolute(rel) ? rel : path.join(root, rel);
}

async function main(): Promise<void> {
  // Args: --map <path> --out <path>
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }

  const root = process.cwd();
  const mapPath = args.get('map') ?? 'docs/spec/examples/vector-id-map.json';
  const outPath = args.get('out') ?? 'docs/spec/hash-index.json';

  const idMap = await loadJson<VectorIdMap>(toAbs(root, mapPath));
  const out: HashIndex = {};

  for (const [id, rel] of Object.entries(idMap)) {
    const abs = absFromRoot(root, rel);
    const payload = await loadJson(abs);
    const canonical = jcsCanonicalize(payload);
    const digest = sha256Hex(canonical);
    const size = Buffer.byteLength(canonical, 'utf8');
    // Store the original relative path
    out[id] = { path: rel, sha256: digest, size };
  }

  await fs.mkdir(path.dirname(toAbs(root, outPath)), { recursive: true });
  await fs.writeFile(toAbs(root, outPath), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`hash-index written to ${outPath}`);
}

await main();
