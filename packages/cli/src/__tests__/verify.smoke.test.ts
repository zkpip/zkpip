import { describe, it, expect } from 'vitest';
import { runCli, fixturesPath, parseJson } from './helpers/cliRunner.js';

type Ok = { ok: true };
type Err = { ok: false; error: string };

describe('zkpip verify exit codes (smoke)', () => {
  it('valid -> exit 0', async () => {
    const vf = fixturesPath('snarkjs-plonk/valid/verification.json');

    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', vf], {
      json: true,
      useExitCodes: true,
    });

    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe('');
    const out = parseJson<Ok>(r.stdout);
    expect(out.ok).toBe(true);
  });

  it('invalid -> exit 1', async () => {
    const vf = fixturesPath('snarkjs-plonk/invalid/verification.json');

    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', vf], {
      json: true,
      useExitCodes: true,
    });

    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe('');
    const err = parseJson<Err>(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('verification_failed');
  });
});
