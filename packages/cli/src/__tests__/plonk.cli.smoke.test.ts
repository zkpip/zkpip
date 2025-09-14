// Keep comments in English (OSS).
import { describe, it, expect } from 'vitest';
import { runCli, parseJson, fixturesPath } from './helpers/cliRunner.js';

type Ok = { ok: true; adapter?: string };
type Err = { ok: false; error: string; stage?: string; message?: string };

describe('CLI smoke: snarkjs-plonk', () => {
  it('valid → exit 0 + ok:true', async () => {
    const r = await runCli([
      'verify',
      '--adapter',
      'snarkjs-plonk',
      '--verification',
      fixturesPath('snarkjs-plonk/valid/verification.json'),
    ]);
    expect(r.exitCode).toBe(0);
    const out = parseJson<Ok>(r.stdout, r.stderr);
    expect(out.ok).toBe(true);
  });

  it('tampered public → exit 1 + verification_failed', async () => {
    const r = await runCli([
      'verify',
      '--adapter',
      'snarkjs-plonk',
      '--verification',
      fixturesPath('snarkjs-plonk/invalid/verification.json'),
    ]);
    expect(r.exitCode).toBe(1);
    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('verification_failed');
  });
});
