// packages/cli/src/__tests__/forge.snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeJsonStable } from '../utils/envelope.js';

describe('forge snapshot (ignore envelopeId)', () => {
  it('stable snapshot except envelopeId', () => {
    const obj = {
      envelopeId: 'env_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      protocol: 'groth16',
      curve: 'bn128',
      adapter: 'snarkjs-groth16',
      createdAt: '2025-01-01T00:00:00.000Z',
      input: { x: 1 },
    };
    const scrubbed = { ...obj, envelopeId: '<IGNORED>' };

    const stable = normalizeJsonStable(scrubbed);
    expect(JSON.parse(stable)).toMatchInlineSnapshot(
    {
        adapter: 'snarkjs-groth16',
        createdAt: '2025-01-01T00:00:00.000Z',
        curve: 'bn128',
        envelopeId: '<IGNORED>',
        input: { x: 1 },
        protocol: 'groth16',
    }, `
      {
        "adapter": "snarkjs-groth16",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "curve": "bn128",
        "envelopeId": "<IGNORED>",
        "input": {
          "x": 1,
        },
        "protocol": "groth16",
      }
    `);

  });
});
