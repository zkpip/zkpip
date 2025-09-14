// packages/cli/src/utils/exitCodeMap.test.ts
import { describe, it, expect } from 'vitest';
import { mapVerifyOutcomeToExitCode } from './exitCodeMap.js';

describe('exit code map', () => {
  it('success -> 0', () => {
    expect(mapVerifyOutcomeToExitCode({ ok: true })).toBe(0);
  });
  it('verification_failed -> 1', () => {
    expect(mapVerifyOutcomeToExitCode({ ok: false, error: 'verification_failed' })).toBe(1);
  });
  it('io_error (stage io) -> 2', () => {
    expect(mapVerifyOutcomeToExitCode({ ok: false, stage: 'io', error: 'io_error' })).toBe(2);
  });
  it('schema_invalid -> 3', () => {
    expect(mapVerifyOutcomeToExitCode({ ok: false, error: 'schema_invalid' })).toBe(3);
  });
  it('adapter_not_found -> 4', () => {
    expect(
      mapVerifyOutcomeToExitCode({ ok: false, stage: 'adapter', error: 'adapter_not_found' }),
    ).toBe(4);
  });
});
