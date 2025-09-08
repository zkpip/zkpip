// NodeNext ESM, no TypeScript build needed.
// Usage:
//   node packages/core/scripts/make-ci-bundle.mjs <input-bundle.json> [<output.json>]
// Produces a bundle with inline verificationKey, result.proof, result.publicSignals (no artifacts).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function asLocalPath(maybe) {
  if (typeof maybe !== 'string') return undefined;
  try {
    return fileURLToPath(maybe); // file://...
  } catch {
    return maybe;
  }
}

function pickPathLike(obj, keys) {
  for (const k of keys) {
    if (obj && typeof obj === 'object' && obj[k] && typeof obj[k] === 'string') return obj[k];
  }
  return undefined;
}

function readJsonSync(p) {
  return JSON.parse(require('node:fs').readFileSync(p, 'utf8'));
}

function norm1(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter(k => /^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
    if (keys.length) return keys.map(k => v[String(k)]);
  }
  return undefined;
}

function norm2(v) {
  const outer = norm1(v);
  if (!outer) return undefined;
  const out = [];
  for (const row of outer) {
    const r = norm1(row);
    if (!r) return undefined;
    out.push(r);
  }
  return out;
}

function normalizeProof(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = norm1(raw.pi_a ?? raw.a);
  const b = norm2(raw.pi_b ?? raw.b);
  const c = norm1(raw.pi_c ?? raw.c);
  if (!a || !b || !c) return undefined;
  return { pi_a: a, pi_b: b, pi_c: c };
}

function toDecString(x) {
  if (typeof x === 'string') {
    const s = x.trim();
    if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s).toString(10);
    return s;
  }
  if (typeof x === 'number') return String(x);
  if (typeof x === 'bigint') return x.toString(10);
  return String(x);
}

function normalizePublicSignals(arr) {
  return (arr ?? []).map(toDecString);
}

async function main() {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error('Usage: node make-ci-bundle.mjs <input-bundle.json> [<output.json>]');
    process.exit(2);
  }
  const absIn = path.resolve(inPath);
  const baseDir = path.dirname(absIn);

  const raw = await fs.readFile(absIn, 'utf8');
  const bundle = JSON.parse(raw);

  const artifacts = (bundle && typeof bundle === 'object') ? bundle.artifacts : undefined;
  if (!artifacts || typeof artifacts !== 'object') {
    console.error('No artifacts found in bundle; nothing to inline.');
  }

  // Resolve vkey
  const vkeyRef = artifacts?.vkey;
  const vkeyPathStr = typeof vkeyRef === 'string'
    ? vkeyRef
    : pickPathLike(vkeyRef ?? {}, ['path', 'uri', 'url']);
  if (!vkeyPathStr) {
    console.error('Missing artifacts.vkey path/uri');
    process.exit(4);
  }
  const vkeyAbs = path.resolve(baseDir, asLocalPath(vkeyPathStr));
  const vkey = readJsonSync(vkeyAbs);

  // Resolve proof
  const proofRef = artifacts?.proof;
  const proofPathStr = typeof proofRef === 'string'
    ? proofRef
    : pickPathLike(proofRef ?? {}, ['path', 'uri', 'url']);
  if (!proofPathStr) {
    console.error('Missing artifacts.proof path/uri');
    process.exit(4);
  }
  const proofAbs = path.resolve(baseDir, asLocalPath(proofPathStr));
  const proofFile = readJsonSync(proofAbs);
  const rawProof = (proofFile && typeof proofFile === 'object' && 'proof' in proofFile) ? proofFile.proof : proofFile;
  const proof = normalizeProof(rawProof);
  if (!proof) {
    console.error('Failed to normalize proof from artifacts.proof');
    process.exit(4);
  }

  // Resolve publicSignals
  // 1) from proof file if present, else separate publicSignals artifact
  let publicSignalsRaw = Array.isArray(proofFile?.publicSignals) ? proofFile.publicSignals : undefined;

  if (!publicSignalsRaw) {
    const pubRef = artifacts?.publicSignals;
    const pubPathStr = typeof pubRef === 'string'
      ? pubRef
      : pickPathLike(pubRef ?? {}, ['path', 'uri', 'url']);
    if (!pubPathStr) {
      console.error('Missing artifacts.publicSignals path/uri');
      process.exit(4);
    }
    const pubAbs = path.resolve(baseDir, asLocalPath(pubPathStr));
    const pubFile = readJsonSync(pubAbs);
    publicSignalsRaw = Array.isArray(pubFile) ? pubFile
      : (pubFile && typeof pubFile === 'object' && Array.isArray(pubFile.publicSignals)) ? pubFile.publicSignals
      : undefined;
  }

  if (!publicSignalsRaw) {
    console.error('Failed to get publicSignals');
    process.exit(4);
  }

  const publicSignals = normalizePublicSignals(publicSignalsRaw);

  // Build CI-inline bundle
  const outBundle = {
    ...bundle,
    verificationKey: vkey,
    result: {
      ...(bundle.result && typeof bundle.result === 'object' ? bundle.result : {}),
      proof,
      publicSignals,
    },
  };
  delete outBundle.artifacts;

  const outPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(absIn), path.basename(absIn).replace(/\.json$/i, '.ci.valid.json'));

  await fs.writeFile(outPath, JSON.stringify(outBundle, null, 2));
  console.log(outPath);
}

await main();
