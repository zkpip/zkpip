import { describe, it, expect } from 'vitest';
import type { Adapter } from '@zkpip/adapters-core';
import { createSnarkjsGroth16Adapter, ID } from '../index.js';

const RAW_SNARKJS_INPUT = {
  verificationKey: { alpha1: '0x01' },
  proof: {
    pi_a: ['0x0', '0x0'],
    pi_b: [
      [
        ['0x0', '0x0'],
        ['0x0', '0x0'],
      ],
    ],
    pi_c: ['0x0', '0x0'],
  },
  publicSignals: ['1', '2', '3'],
};

describe('snarkjs-groth16 adapter', () => {
  const makeAdapter = (result: boolean): Adapter =>
    createSnarkjsGroth16Adapter(async () => ({
      async verify() {
        return result;
      },
    }));

  it('has stable id', () => {
    const a = makeAdapter(true);
    expect(a.id).toBe(ID);
  });

  it('canHandle detects common snarkjs shapes', () => {
    const a = makeAdapter(true);
    expect(a.canHandle(RAW_SNARKJS_INPUT)).toBe(true);
  });

  it('toEnvelope normalizes raw snarkjs input', () => {
    const a = makeAdapter(true);
    const env = a.toEnvelope(RAW_SNARKJS_INPUT);
    expect(env.version).toBe(1);
    expect(env.proofSystem).toBe('groth16');
    expect(env.framework).toBe('snarkjs');
    expect(env.publics.length).toBe(3);
  });

  it('verify resolves true', async () => {
    const a = makeAdapter(true);
    await expect(a.verify(RAW_SNARKJS_INPUT)).resolves.toBe(true);
  });

  it('verify resolves false', async () => {
    const a = makeAdapter(false);
    await expect(a.verify(RAW_SNARKJS_INPUT)).resolves.toBe(false);
  });
});
