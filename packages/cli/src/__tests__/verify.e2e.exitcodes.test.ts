import { describe, it, expect } from 'vitest';
import { runCli, fixturesPath, parseJson } from './helpers/cliRunner.js';

type Ok = { ok: true };
type Err = {
  ok: false;
  error:
    | 'verification_failed'
    | 'adapter_not_found'
    | 'schema_invalid'
    | 'io_error'
    | 'adapter_error';
  stage?: 'verify' | 'schema' | 'io' | string;
  message?: string;
};

describe('verify --use-exit-codes E2E', () => {
  it('0 → valid bundle (verify success)', async () => {
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

  it('1 → verification failed (invalid bundle content)', async () => {
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

  it('4 → adapter not found (forced bad adapter)', async () => {
    const r = await runCli(
      [
        'verify',
        '--adapter',
        'not-a-real-adapter',
        '--verification',
        fixturesPath('snarkjs-plonk/valid/verification.json'),
      ],
      { json: true, useExitCodes: true },
    );
    expect(r.exitCode).toBe(4);
    expect(r.stdout).toBe('');
    const err = parseJson<Err>(r.stderr);
    expect(err.error).toBe('adapter_not_found');
  });

  it('3 → schema invalid (quick schema failure)', async () => {
    const r = await runCli(
      ['verify', '--adapter', 'snarkjs-plonk', '--verification', '{"proof":""}'],
      { json: true, useExitCodes: true },
    );
    expect(r.exitCode).toBe(3);
    expect(r.stdout).toBe('');
    const err = parseJson<Err>(r.stderr);
    expect(err.error).toBe('schema_invalid');
    expect(err.stage).toBe('schema');
  });

  it('2 → I/O error (ENOENT)', async () => {
    const r = await runCli(
      ['verify', '--adapter', 'snarkjs-plonk', '--verification', 'definitely-does-not-exist.json'],
      { json: true, useExitCodes: true },
    );
    expect(r.exitCode).toBe(2);
    expect(r.stdout).toBe('');
    const err = parseJson<Err>(r.stderr);
    expect(err.error).toBe('io_error');
    expect(err.stage).toBe('io');
  });
});
