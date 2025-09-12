import { describe, it, expect } from 'vitest';
import { runCli, parseJson } from './helpers/cliRunner.js';

interface AdapterRow {
  readonly id: string;
  readonly proofSystem: string;
  readonly framework: string;
}

describe('adapters --json smoke', () => {
  it('prints a non-empty adapter list with id/proofSystem/framework', async () => {
    const r = await runCli(['adapters', '--json'], { json: false, useExitCodes: true });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe('');
    const arr = parseJson<readonly AdapterRow[]>(r.stdout);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThan(0);
    for (const a of arr) {
      expect(typeof a.id).toBe('string');
      expect(typeof a.proofSystem).toBe('string');
      expect(typeof a.framework).toBe('string');
    }
  });
});
