import { describe, it, expect } from 'vitest';
import { plonkAdapter } from '../index';

describe('plonkAdapter (dummy)', () => {
  it('accepts a plonk bundle', async () => {
    const res = await plonkAdapter.verify({ id: '1', adapter: 'plonk', payload: {} });
    expect(res.ok).toBe(true);
    expect(res.adapter).toBe('plonk');
  });

  it('rejects non-plonk bundle', async () => {
    const res = await plonkAdapter.verify({ id: 'x', adapter: 'groth16', payload: {} } as any);
    expect(res.ok).toBe(false);
  });
});
