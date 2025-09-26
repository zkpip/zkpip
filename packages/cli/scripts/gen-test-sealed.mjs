#!/usr/bin/env node
// packages/cli/scripts/gen-test-sealed.mjs
// Quick helper to generate a valid sealed.json and matching public key for `zkpip vectors verify-seal`.
// - Node 20+/22+ only, ESM
// - Writes: <out> (sealed.json) and <keyDir>/<keyId>.pub.pem
// - Uses the same canonicalization contract as our CLI: lexicographically sorted object keys.

import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';
import { dirname, resolve } from 'node:path';

// ---- tiny argv parser ----
const argv = process.argv.slice(2);
const flags = new Map();
for (let i = 0; i < argv.length; i++) {
  const t = argv[i];
  if (t.startsWith('--')) {
    const k = t.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : 'true';
    flags.set(k, v);
  }
}

const outPath = resolve(String(flags.get('out') ?? 'sealed.json'));
const keyDir = resolve(String(flags.get('key-dir') ?? './tmp-keys'));
const keyId = String(flags.get('key-id') ?? 'test1');

// ---- canonical stringify (must mirror CLI) ----
function stableStringify(value) {
  const seen = new WeakSet();
  function walk(v) {
    if (v === null) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v !== 'object') throw new Error('UNSUPPORTED_TYPE');
    const obj = v;
    if (seen.has(obj)) throw new Error('CYCLE_NOT_SUPPORTED');
    seen.add(obj);
    const out = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) out[k] = walk(obj[k]);
    return out;
  }
  return JSON.stringify(walk(value));
}

function sha256Hex(s) { return createHash('sha256').update(s).digest('hex'); }
function urnFromHex(hex) { return `urn:zkpip:vector:sha256:${hex}`; }

// ---- demo vector (same as in tests) ----
const vector = {
  zeta: 3,
  alpha: 'x',
  nested: { b: [3, 2, 1], a: { y: null, x: true } },
  list: [{ k: 'v' }, { k: 'w' }],
};

// ---- generate keys ----
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

// ---- seal ----
const canonical = stableStringify(vector);
const id = sha256Hex(canonical);
const sig = edSign(null, Buffer.from(canonical, 'utf8'), createPrivateKey(privPem)).toString('base64');

const sealed = {
  vector,
  seal: { algo: 'ed25519', keyId, id, signature: sig },
};

// ---- write files ----
await mkdir(keyDir, { recursive: true });
await writeFile(resolve(keyDir, `${keyId}.pub.pem`), pubPem, 'utf8');
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(sealed, null, 2), 'utf8');

console.log('[gen-test-sealed] ok');
console.log('  out      :', outPath);
console.log('  keyId    :', keyId);
console.log('  keyDir   :', keyDir);
console.log('  vector URN:', urnFromHex(id));
console.log('\nTry:');
console.log(`  node dist/index.js vectors verify-seal --json --in ${outPath} --key-dir ${keyDir}`);
