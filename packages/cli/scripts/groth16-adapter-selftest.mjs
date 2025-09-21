// Minimal self-test for snarkjs-groth16 adapter (NodeNext/ESM)
import { readFileSync, writeFileSync } from 'node:fs';
import { getAdapterById } from '../dist/registry/adapterRegistry.js';

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

const VALID = process.argv[2]; // /tmp/ci-inline.valid.json
let INVALID = process.argv[3]; // optional: /tmp/ci-inline.invalid.json

if (!VALID) {
  console.error('usage: node scripts/groth16-adapter-selftest.mjs <valid.json> [invalid.json]');
  process.exit(2);
}

const validObj = loadJson(VALID);

// make invalid if not provided
if (!INVALID) {
  INVALID = '/tmp/ci-inline.invalid.from-selftest.json';
  const inv = clone(validObj);
  inv.result.proof.pi_a[0] = (BigInt(inv.result.proof.pi_a[0]) + 1n).toString(10);
  writeFileSync(INVALID, JSON.stringify(inv));
}

const invalidObj = loadJson(INVALID);

const tests = [
  {
    name: 'path input (valid)',
    input: VALID,
    expect: { ok: true },
  },
  {
    name: 'inline object (valid)',
    input: validObj,
    expect: { ok: true },
  },
  {
    name: 'stringified verificationKey (valid)',
    input: (() => {
      const j = clone(validObj);
      j.verificationKey = JSON.stringify(j.verificationKey);
      return j;
    })(),
    expect: { ok: true },
  },
  {
    name: 'stringified publicSignals (valid)',
    input: (() => {
      const j = clone(validObj);
      j.result.publicSignals = JSON.stringify(j.result.publicSignals);
      return j;
    })(),
    expect: { ok: true },
  },
  {
    name: 'CSV publicSignals (valid)',
    input: (() => {
      const j = clone(validObj);
      const arr = j.result.publicSignals;
      j.result.publicSignals = Array.isArray(arr) ? arr.join(',') : j.result.publicSignals;
      return j;
    })(),
    expect: { ok: true },
  },
  {
    name: 'missing vkey → adapter_error',
    input: (() => {
      const j = clone(validObj);
      delete j.verificationKey;
      // biztos ami biztos: próbáljuk a szokásos helyekről is kivenni
      if (j.result) delete j.result.verificationKey;
      if (j.bundle) delete j.bundle.verificationKey;
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
  const snarkjsGroth16 = await getAdapterById('snarkjs-groth16');
  const res = await snarkjsGroth16.verify(t.input);
  const pass =
    'ok' in t.expect
      ? res.ok === t.expect.ok && (!t.expect.ok ? res.error === t.expect.error : true)
      : false;

  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${t.name} →`, res);
  if (!pass) fails++;
}

process.exit(fails ? 1 : 0);
