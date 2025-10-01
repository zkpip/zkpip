// Minimal self-test for snarkjs-groth16 adapter (NodeNext/ESM)
// - No hard process.exit() calls
// - Library code returns ExitCode; entry sets process.exitCode

import { readFileSync, writeFileSync } from 'node:fs';
import { getAdapterById } from '../dist/registry/adapterRegistry.js';
import { ExitCode } from './utils/exit-codes.mjs';

/** Safe JSON loader */
function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Main test runner (no side-effect exits here).
 * @param {readonly string[]} argv
 * @returns {Promise<number>} ExitCode
 */
async function main(argv) {
  const VALID = argv[2]; // /tmp/ci-inline.valid.json
  let INVALID = argv[3]; // optional: /tmp/ci-inline.invalid.json

  if (!VALID) {
    const note = `usage: node scripts/groth16-adapter-selftest.mjs <valid.json> [invalid.json]`;
    console.error(note);
    return ExitCode.INVALID_ARGS;
  }

  let validObj;
  try {
    validObj = loadJson(VALID);
  } catch (e) {
    console.error(`Failed to read valid JSON at ${VALID}:`, e?.message ?? String(e));
    return ExitCode.IO_ERROR;
  }

  // Make invalid if not provided
  if (!INVALID) {
    try {
      INVALID = '/tmp/ci-inline.invalid.from-selftest.json';
      const inv = clone(validObj);
      inv.result.proof.pi_a[0] = (BigInt(inv.result.proof.pi_a[0]) + 1n).toString(10);
      writeFileSync(INVALID, JSON.stringify(inv));
    } catch (e) {
      console.error(`Failed to generate invalid JSON:`, e?.message ?? String(e));
      return ExitCode.UNEXPECTED;
    }
  }

  let invalidObj;
  try {
    invalidObj = loadJson(INVALID);
  } catch (e) {
    console.error(`Failed to read invalid JSON at ${INVALID}:`, e?.message ?? String(e));
    return ExitCode.IO_ERROR;
  }

  const tests = [
    { name: 'path input (valid)', input: VALID, expect: { ok: true } },
    { name: 'inline object (valid)', input: validObj, expect: { ok: true } },
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

  // Fetch adapter once (it is stable across iterations)
  const snarkjsGroth16 = await getAdapterById('snarkjs-groth16');

  for (const t of tests) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await snarkjsGroth16.verify(t.input);
      const pass =
        'ok' in t.expect
          ? res.ok === t.expect.ok && (!t.expect.ok ? res.error === t.expect.error : true)
          : false;

      const icon = pass ? '✅' : '❌';
      console.log(`${icon} ${t.name} →`, res);
      if (!pass) fails++;
    } catch (e) {
      console.error(`❌ ${t.name} → threw:`, e?.message ?? String(e));
      fails++;
    }
  }

  return fails ? ExitCode.UNEXPECTED : ExitCode.OK;
}

// ─── Entry (the only place that touches process.exitCode) ──────────────────────
const code = await main(process.argv);
process.exitCode = code;
