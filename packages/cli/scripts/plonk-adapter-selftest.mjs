// Minimal self-test for snarkjs-plonk adapter (NodeNext/ESM)
// Usage: node scripts/plonk-adapter-selftest.mjs <valid.json> [invalid.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { snarkjsPlonk } from '../dist/adapters/snarkjs-plonk.js';

function loadJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// Flip one hex digit deterministically
function bitflipHexString(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  const idx = s.startsWith('0x') || s.startsWith('0X') ? 2 : 0;
  if (s.length <= idx) return s + 'f';
  const c = s[idx];
  const flipped = (c.toLowerCase() !== 'f') ? 'f' : 'e';
  return s.slice(0, idx) + flipped + s.slice(idx + 1);
}

// Try to mutate proof or publicSignals to make it invalid
function makeInvalidFromValid(j) {
  const k = clone(j);
  if (k?.result && typeof k.result.proof === 'string') {
    k.result.proof = bitflipHexString(k.result.proof);
    return k;
  }
  if (typeof k.proof === 'string') {
    k.proof = bitflipHexString(k.proof);
    return k;
  }
  // fallback: bump first public signal
  const arr = k?.result?.publicSignals;
  if (Array.isArray(arr) && arr.length > 0) {
    const x = arr[0];
    try {
      const bumped = (typeof x === 'string')
        ? (BigInt(x.startsWith('0x') ? x : x) + 1n).toString(10)
        : (typeof x === 'number')
          ? (BigInt(x) + 1n).toString(10)
          : (typeof x === 'bigint')
            ? (x + 1n).toString(10)
            : null;
      if (bumped !== null) {
        k.result.publicSignals[0] = bumped;
        return k;
      }
    } catch {/* ignore */}
  }
  return null; // if we couldn't mutate, signal to caller
}

const VALID = process.argv[2];
let INVALID = process.argv[3];

if (!VALID) {
  console.error('usage: node scripts/plonk-adapter-selftest.mjs <valid.json> [invalid.json]');
  process.exit(2);
}

const validObj = loadJson(VALID);

// If invalid path not provided, synthesize one
if (!INVALID) {
  INVALID = '/tmp/ci-inline.plonk.invalid.json';
  const inv = makeInvalidFromValid(validObj);
  if (inv) {
    writeFileSync(INVALID, JSON.stringify(inv));
  } else {
    // last resort: corrupt proof field path if exists
    const tmp = clone(validObj);
    if (tmp?.result && typeof tmp.result.proof === 'string') {
      tmp.result.proof = tmp.result.proof + '00';
    }
    writeFileSync(INVALID, JSON.stringify(tmp));
  }
}
const invalidObj = loadJson(INVALID);

const tests = [
  { name: 'path input (valid)', input: VALID, expect: { ok: true } },
  { name: 'inline object (valid)', input: validObj, expect: { ok: true } },
  {
    name: 'stringified verificationKey (valid)',
    input: (() => {
      const j = clone(validObj);
      if (j.verificationKey) j.verificationKey = JSON.stringify(j.verificationKey);
      return j;
    })(),
    expect: { ok: true },
  },
  {
    name: 'stringified publicSignals (valid)',
    input: (() => {
      const j = clone(validObj);
      if (j?.result?.publicSignals) j.result.publicSignals = JSON.stringify(j.result.publicSignals);
      return j;
    })(),
    expect: { ok: true },
  },
  {
    name: 'CSV publicSignals (valid)',
    input: (() => {
      const j = clone(validObj);
      const arr = j?.result?.publicSignals;
      if (Array.isArray(arr)) j.result.publicSignals = arr.join(',');
      return j;
    })(),
    expect: { ok: true },
  },
  {
    name: 'missing vkey → adapter_error',
    input: (() => {
      const j = clone(validObj);
      delete j.verificationKey;
      if (j?.result) delete j.result.verificationKey;
      if (j?.bundle) delete j.bundle.verificationKey;
      return j;
    })(),
    expect: { ok: false, error: 'adapter_error' },
  },
  {
    name: 'bitflip proof (invalid) → verification_failed',
    input: invalidObj,
    expect: { ok: false, error: 'verification_failed' },
  },
];

let fails = 0;
for (const t of tests) {
  // eslint-disable-next-line no-await-in-loop
  const res = await snarkjsPlonk.verify(t.input);
  const pass = res.ok === t.expect.ok && (!t.expect.ok ? res.error === t.expect.error : true);
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${t.name} →`, res);
  if (!pass) fails++;
}
process.exit(fails ? 1 : 0);
