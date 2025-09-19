// packages/cli/src/__tests__/plonk.cli.smoke.test.ts
import { describe, it, expect } from 'vitest';
import { runCliFast, parseJson, runCli } from './helpers/cliRunner.js';
import { plonkValid, plonkInvalid } from './helpers/fixtures.js';

type Ok = { readonly ok: true; readonly adapter?: string };
type Err = { readonly ok: false; readonly error: string; readonly stage?: string; readonly message?: string };

describe('CLI smoke: snarkjs-plonk', () => {
  it('valid → exit 0 + ok:true', async () => {
    const r = await runCliFast([
      'verify',
      '--adapter', 'snarkjs-plonk',
      '--verification', plonkValid,
    ]);
    expect(r.exitCode).toBe(0);

    const out = parseJson<Ok>(r.stdout, r.stderr);
    expect(out.ok).toBe(true);
  });

  it('tampered public → exit 1 + verification_failed', async () => {
    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkInvalid]);
    expect(r.exitCode).toBe(1);

    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('verification_failed');
  });
});
