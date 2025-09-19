// packages/cli/src/__tests__/verify.e2e.exitcodes.test.ts
import { describe, it, expect } from 'vitest';
import { runCli, runCliFast, parseJson } from './helpers/cliRunner.js';
import { plonkValid, plonkInvalid, enoentPath } from './helpers/fixtures.js';

type Ok = { ok: true };
type Err = {
  ok: false;
  error: 'verification_failed' | 'adapter_not_found' | 'schema_invalid' | 'io_error' | 'adapter_error';
  stage?: 'verify' | 'schema' | 'io' | string;
  message?: string;
};

describe('verify --use-exit-codes E2E', () => {
  it('0 → valid envelope (verify success)', async () => {
    const r = await runCliFast(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkValid]);
    expect(r.exitCode).toBe(0);
    const out = parseJson<Ok>(r.stdout, r.stderr);
    expect(out.ok).toBe(true);
  });

  it('1 → verification failed (invalid envelope content)', async () => {
    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkInvalid]);
    expect(r.exitCode).toBe(1);
    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('verification_failed');
  });

  it('4 → adapter not found (forced bad adapter)', async () => {
    const r = await runCli(['verify', '--adapter', 'not-a-real-adapter', '--verification', plonkValid]);
    expect(r.exitCode).toBe(4);
    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('adapter_not_found');
  });

  it('3 → schema invalid (quick schema failure)', async () => {
    // Inline JSON to trigger schema validation path (not a filesystem path)
    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', '{"proof":""}']);
    expect(r.exitCode).toBe(3);
    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('schema_invalid');
    expect(err.stage).toBe('schema');
  });

  it('2 → I/O error (ENOENT)', async () => {
    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', enoentPath]);
    expect(r.exitCode).toBe(2);
    const err = parseJson<Err>(r.stdout, r.stderr);
    expect(err.ok).toBe(false);
    expect(err.error).toBe('io_error');
    expect(err.stage).toBe('io');
  });
});
