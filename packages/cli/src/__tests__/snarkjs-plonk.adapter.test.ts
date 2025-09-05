import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest'; // <- type import, nem value

vi.mock('snarkjs', () => ({
  plonk: {
    verify: vi.fn(async () => true),
  },
}));

import { snarkjsPlonk } from '../adapters/snarkjs-plonk.js';

const base = {
  proofSystem: 'plonk',
  framework: 'snarkjs',
  proof: { pi_a: [] },
  publicSignals: ['1', '2'],
  verificationKey: {},
} as const;

describe('snarkjs-plonk adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canHandle() true on plonk+snarkjs + pieces present', () => {
    expect(snarkjsPlonk.canHandle({ ...base })).toBe(true);
  });

  it('verify() ok=true when snarkjs returns true', async () => {
    const res = await snarkjsPlonk.verify({ ...base });
    expect(res.ok).toBe(true);
  });

  it('verify() ok=false when snarkjs throws', async () => {
    const mod = await import('snarkjs');
    (mod.plonk.verify as unknown as Mock).mockRejectedValueOnce(new Error('boom'));
    const res = await snarkjsPlonk.verify({ ...base });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('exception_during_verify');
  });

  it('verify() ok=false invalid_input when pieces missing', async () => {
    const res = await snarkjsPlonk.verify({ proofSystem: 'plonk', framework: 'snarkjs' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('invalid_input');
  });
});
