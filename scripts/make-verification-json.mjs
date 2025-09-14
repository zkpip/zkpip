#!/usr/bin/env node
// scripts/make-verification-json.mjs
// Robust converter: takes various vc/proof/public(s) shapes (bundle or flat),
// outputs { framework, proofSystem, verificationKey, proof, publicSignals:string[] }.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function toStringArray(values) {
  return (Array.isArray(values) ? values : []).map((v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'bigint') return v.toString(10);
    try {
      const s = v?.toString?.();
      if (s && s !== '[object Object]') return String(s);
    } catch {
      /* nothing to do */
    }
    return JSON.stringify(v);
  });
}

function get(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function pickPublics(root) {
  const bundle = get(root, ['bundle']);
  const result = get(root, ['result']);
  const artifacts = get(root, ['artifacts']);
  const artBundle = artifacts && get(artifacts, ['bundle']);

  return (
    get(root, ['publicSignals', 'publics', 'public', 'inputs']) ??
    (bundle && get(bundle, ['publicSignals', 'publics', 'public', 'inputs'])) ??
    (result && get(result, ['publicSignals', 'publics', 'public', 'inputs'])) ??
    (artBundle && get(artBundle, ['publicSignals', 'publics', 'public', 'inputs'])) ??
    (artifacts && get(artifacts, ['publicSignals', 'publics', 'public', 'inputs'])) ??
    []
  );
}

function pickVKey(root) {
  const bundle = get(root, ['bundle']);
  const result = get(root, ['result']);
  const artifacts = get(root, ['artifacts']);
  const artBundle = artifacts && get(artifacts, ['bundle']);

  return (
    get(root, ['verificationKey', 'verification_key', 'vk']) ??
    (bundle && get(bundle, ['verificationKey', 'verification_key'])) ??
    (result && get(result, ['verificationKey', 'verification_key'])) ??
    (artBundle && get(artBundle, ['verificationKey', 'verification_key'])) ??
    (artifacts && get(artifacts, ['verificationKey', 'verification_key'])) ??
    null
  );
}

function pickProof(root) {
  const bundle = get(root, ['bundle']);
  const result = get(root, ['result']);
  const artifacts = get(root, ['artifacts']);
  const artBundle = artifacts && get(artifacts, ['bundle']);

  return (
    get(root, ['proof']) ??
    (bundle && get(bundle, ['proof'])) ??
    (result && get(result, ['proof'])) ??
    (artBundle && get(artBundle, ['proof'])) ??
    (artifacts && get(artifacts, ['proof'])) ??
    null
  );
}

function parseArgs(argv) {
  const kv = Object.fromEntries(
    argv.slice(2).map((a) => {
      const [k, ...rest] = a.split('=');
      return [k.replace(/^--/, ''), rest.join('=')];
    }),
  );
  const framework = kv.framework ?? 'snarkjs';
  const proofSystem = kv.proofSystem ?? 'plonk';
  const inPath = resolve(process.cwd(), kv.in);
  const outPath = resolve(process.cwd(), kv.out);
  return { framework, proofSystem, inPath, outPath };
}

async function main() {
  const { framework, proofSystem, inPath, outPath } = parseArgs(process.argv);

  const raw = JSON.parse(await readFile(inPath, 'utf8'));

  const verificationKey = pickVKey(raw);
  const proof = pickProof(raw);
  const publics = toStringArray(pickPublics(raw));

  if (!verificationKey || !proof) {
    throw new Error(
      `Missing verificationKey/proof in ${inPath}. Expected keys under flat/bundle/result/artifacts.`,
    );
  }

  const out = {
    framework,
    proofSystem,
    verificationKey,
    proof,
    publicSignals: publics,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${outPath}`);
}

await main();
