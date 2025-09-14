// Keep comments in English (OSS).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { runCli, parseJson, fixturesPath } from './helpers/cliRunner.js';

type VerifyOk = { ok: true; adapter?: string };
type VerifyErr = { ok: false; error: string; stage?: string; message?: string };

/** Tiny helper to skip tests when optional fixtures are missing. */
const itIf = (cond: boolean) => (cond ? it : it.skip);

describe('adapters.smoke (CLI roundtrip via fixtures)', () => {
  // --- PLONK (fixtures are expected to exist) ---
  it('snarkjs-plonk valid → exit 0 + ok:true', async () => {
    const p = await runCli([
      'verify',
      '--adapter',
      'snarkjs-plonk',
      '--verification',
      fixturesPath('snarkjs-plonk/valid/verification.json'),
    ]);
    expect(p.exitCode).toBe(0);
    const out = parseJson<VerifyOk>(p.stdout, p.stderr);
    expect(out.ok).toBe(true);
  });

  it('snarkjs-plonk invalid → exit 1 + verification_failed', async () => {
    const p = await runCli([
      'verify',
      '--adapter',
      'snarkjs-plonk',
      '--verification',
      fixturesPath('snarkjs-plonk/invalid/verification.json'),
    ]);
    expect(p.exitCode).toBe(1);
    const out = parseJson<VerifyErr>(p.stdout, p.stderr);
    expect(out.ok).toBe(false);
    expect(out.error).toBe('verification_failed');
  });

  // --- Groth16 (optional: run only if valid fixture exists) ---
  const g16Valid = fixturesPath('snarkjs-groth16/valid/verification.json');
  itIf(existsSync(g16Valid))('snarkjs-groth16 valid → exit 0', async () => {
    const p = await runCli(['verify', '--adapter', 'snarkjs-groth16', '--verification', g16Valid]);
    expect(p.exitCode).toBe(0);
    const out = parseJson<VerifyOk>(p.stdout, p.stderr);
    expect(out.ok).toBe(true);
  });

  // --- ZoKrates Groth16 (optional: run only if valid fixture exists) ---
  const zoValid = fixturesPath('zokrates-groth16/valid/verification.json');
  itIf(existsSync(zoValid))('zokrates-groth16 valid → exit 0', async () => {
    const p = await runCli(['verify', '--adapter', 'zokrates-groth16', '--verification', zoValid]);
    expect(p.exitCode).toBe(0);
    const out = parseJson<VerifyOk>(p.stdout, p.stderr);
    expect(out.ok).toBe(true);
  });
});
