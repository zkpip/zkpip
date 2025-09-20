// packages/core/src/__tests__/addCoreSchemas.spec.ts
import { describe, it, expect } from 'vitest';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import type { AjvRegistryLike } from '../validation/ajv-types.js';
import type { ValidateFunction } from 'ajv/dist/2020';

function createRegistry(): { reg: AjvRegistryLike; keys: Set<string> } {
  const keys = new Set<string>();

  // Minimal dummy validator satisfying Ajv's ValidateFunction signature
  const dummyValidate = (((_data: unknown) => true) as unknown) as ValidateFunction<unknown>;

  const reg: AjvRegistryLike = {
    addSchema: (_schema: object, key?: string) => {
      if (key) keys.add(key);
    },
    getSchema: (key: string) => {
      return keys.has(key) ? dummyValidate : undefined;
    },
  };

  return { reg, keys };
}

describe('addCoreSchemas()', () => {
  it('registers canonical IDs and aliases for proofEnvelope', () => {
    const { reg, keys } = createRegistry();

    // Use repo-default schemas dir (packages/core/schemas/)
    addCoreSchemas(reg, { debug: false });

    // Canonical present
    expect(keys.has(CANONICAL_IDS.proofEnvelope)).toBe(true);

    // Official colon-form present
    expect(keys.has('urn:zkpip:mvs:schemas:proofEnvelope.schema.json')).toBe(true);

    // Common short aliases present
    expect(keys.has('mvs/proofEnvelope.schema.json')).toBe(true);
    expect(keys.has('mvs/proof-envelope')).toBe(true);

    // Spot-check a couple of others
    expect(keys.has(CANONICAL_IDS.verification)).toBe(true);
    expect(keys.has(CANONICAL_IDS.cir)).toBe(true);
  });
});
