// packages/core/src/__tests__/proofEnvelope.valid.test.ts
import { describe, it, expect } from 'vitest';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';

const SCHEMA_IDS = [
  'urn:zkpip:mvs:schemas:proofEnvelope.schema.json',
  'urn:zkpip:mvs.proofEnvelope.schema.json',
] as const;

function compileEnvelopeValidator() {
  const ajv = createAjv();
  addCoreSchemas(ajv);
  for (const id of SCHEMA_IDS) {
    const v = ajv.getSchema(id);
    if (v) return v;
  }
  return ajv.compile({ $ref: SCHEMA_IDS[0] });
}

describe('ProofEnvelope schema — minimal valid envelope (result branch)', () => {
  it('accepts a minimal but valid envelope payload', () => {
    const validate = compileEnvelopeValidator();

    const validEnvelope = {
      envelopeId: 'urn:uuid:00000000-0000-4000-8000-0000000000AA',
      schemaVersion: '0.1.0',
      proofSystem: 'groth16',
      curve: 'bn128',
      prover: { name: 'snarkjs', version: '0.7.0' },
      program: { language: 'circom', entry: 'circuits/main.circom', name: 'main' },
      artifacts: {},                // <-- required at top-level, can be empty
      result: {
        proof: {},                  // object allowed; content shape is backend-specific
        publicSignals: ['1'],       // ≥1 item; string or number allowed
      },
    };

    const ok = validate(validEnvelope);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error('Validation errors:', validate.errors);
    }
    expect(ok).toBe(true);
  });
});
