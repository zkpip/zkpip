import { describe, it, expect } from 'vitest';
import { groth16Adapter } from '../../src';

describe('groth16Adapter (dummy)', () => {
  it('accepts a groth16 bundle', async () => {
    const res = await groth16Adapter.verify({ id: '1', adapter: 'groth16', payload: {} });
    expect(res.ok).toBe(true);
    expect(res.adapter).toBe('groth16');
  });

  it('rejects non-groth16 bundle', async () => {
    const res = await groth16Adapter.verify({ id: 'x', adapter: 'plonk', payload: {} } as any);
    expect(res.ok).toBe(false);
  });
});
