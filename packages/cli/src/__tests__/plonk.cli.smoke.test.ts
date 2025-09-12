import { describe, it, expect } from 'vitest';
import { runCli, fixturesPath, parseJson } from './helpers/cliRunner.js';

type Ok = { ok: true };
type Err = { ok: false; error: string; stage?: string };

describe('CLI smoke: snarkjs-plonk', () => {
  it('valid file → exit 0 + ok:true', async () => {
    const r = await runCli(
      [
        'verify',
        '--adapter',
        'snarkjs-plonk',
        '--verification',
        fixturesPath('snarkjs-plonk/valid/verification.json'),
      ],
      { json: true, useExitCodes: true },
    );
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe('');
    const out = parseJson<Ok>(r.stdout);
    expect(out.ok).toBe(true);
  });

  it('tampered public → exit 1 + verification_failed', async () => {
    const r = await runCli(
      [
        'verify',
        '--adapter',
        'snarkjs-plonk',
        '--verification',
        fixturesPath('snarkjs-plonk/invalid/verification.json'),
      ],
      { json: true, useExitCodes: true },
    );
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe('');
    const err = parseJson<Err>(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('verification_failed');
  });

  it('broken JSON path → exit 2 + stage:"io"', async () => {
    // Purposely pass a non-existent path to trigger IO error (or supply a broken JSON file in fixtures)
    const r = await runCli(
      ['verify', '--adapter', 'snarkjs-plonk', '--verification', 'non-existent.json'],
      { json: true, useExitCodes: true },
    );
    expect(r.exitCode).toBe(2);
    expect(r.stdout).toBe('');
    const err = parseJson<Err>(r.stderr);
    expect(err.error).toBe('io_error');
    expect(err.stage).toBe('io');
  });
});
