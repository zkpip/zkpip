import { describe, it, expect } from 'vitest';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';

const SCHEMA_ID = 'urn:zkpip:mvs.proofEnvelope.schema.json';

const ENV_VALID = {
  version: 1,
  proofSystem: 'groth16',
  framework: 'snarkjs',
  vkey: { alpha1: '0x01' },
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
  publics: ['1', '2', '3'],
};

describe('ProofEnvelope v1 — VALID vectors', () => {
  const ajv = createAjv();
  addCoreSchemas(ajv); // <- ez nálad automatikusan felveszi az összes sémát

  it('accepts canonical envelope', () => {
    const validate = ajv.getSchema(SCHEMA_ID) ?? ajv.compile({ $ref: SCHEMA_ID });
    expect(validate(ENV_VALID)).toBe(true);
  });
});
