import { describe, it, expect } from 'vitest';
import { starkAdapter } from '../index';

describe('starkAdapter (dummy)', () => {
  it('accepts a stark bundle', async () => {
    const res = await starkAdapter.verify({ id: '1', adapter: 'stark', payload: {} });
    expect(res.ok).toBe(true);
    expect(res.adapter).toBe('stark');
  });

  it('rejects non-stark bundle', async () => {
    const res = await starkAdapter.verify({ id: 'x', adapter: 'groth16', payload: {} } as any);
    expect(res.ok).toBe(false);
  });
});
