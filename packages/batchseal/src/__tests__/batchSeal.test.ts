import { describe, it, expect } from 'vitest';
import { sealBatch } from '../index.js';
import { groth16Adapter } from '@zkpip/adapters-groth16';
import type { ProofBundle } from '@zkpip/core';

describe('sealBatch (dummy)', () => {
  it('verifies a batch with groth16 adapter', async () => {
    const vectors: ProofBundle[] = [
      { id: 'vec1.json', adapter: 'groth16', payload: {} },
      { id: 'vec2.json', adapter: 'groth16', payload: {} },
    ];

    const res = await sealBatch(groth16Adapter, vectors);

    expect(res.adapter).toBe('groth16');
    expect(res.total).toBe(2);
    expect(res.passed).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.results.every(r => r.ok)).toBe(true);
  });

  it('returns WRONG_ADAPTER if bundle kind mismatches', async () => {
    const vectors: ProofBundle[] = [
      { id: 'wrong.json', adapter: 'plonk', payload: {} }, // wrong kind
    ];

    const res = await sealBatch(groth16Adapter, vectors);

    expect(res.failed).toBe(1);
    expect(res.results[0].ok).toBe(false);
    expect(res.results[0]).toHaveProperty('code', 'WRONG_ADAPTER');
  });
});
