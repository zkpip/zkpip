// Keep comments in English (OSS).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { runCli, parseJson, fixturesPath } from './helpers/cliRunner.js';

type Ok = { ok: true; adapter: string };
type Err = { ok: false; error: string; stage?: string; message?: string };

/** Utility: choose `it` or `it.skip` based on a condition. */
function itIf(cond: boolean) {
  return cond ? it : it.skip;
}

describe('zkpip verify (smoke)', () => {
  // --- PLONK (always expected to exist) ---
  const plonkValid = fixturesPath('snarkjs-plonk/valid/verification.json');
  const plonkInvalid = fixturesPath('snarkjs-plonk/invalid/verification.json');

  it('plonk valid → exit 0 + ok:true', async () => {
    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkValid]);
    expect(r.exitCode).toBe(0);
    const out = parseJson<Ok>(r.stdout, r.stderr);
    expect(out).toEqual({ ok: true, adapter: 'snarkjs-plonk' });
  });

  it('plonk invalid → exit 1 + verification_failed', async () => {
    const r = await runCli([
      'verify',
      '--adapter',
      'snarkjs-plonk',
      '--verification',
      plonkInvalid,
    ]);
    expect(r.exitCode).toBe(1);
    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('verification_failed');
  });

  // --- Groth16 (optional: skip if fixture not present in the repo) ---
  const g16Valid = fixturesPath('snarkjs-groth16/valid/verification.json');
  const hasG16 = existsSync(g16Valid);

  itIf(hasG16)('groth16 valid → exit 0 + ok:true', async () => {
    const r = await runCli(['verify', '--adapter', 'snarkjs-groth16', '--verification', g16Valid]);
    expect(r.exitCode).toBe(0);
    const out = parseJson<Ok>(r.stdout, r.stderr);
    expect(out).toEqual({ ok: true, adapter: 'snarkjs-groth16' });
  });
});
