// packages/core/src/__tests__/ecosystemVector.valid.test.ts
import { describe, it, expect } from 'vitest';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '../index.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { vectors, readJson } from '../test-helpers/vectorPaths.js';

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

describe('Vector: ecosystem/aztec.json', () => {
  it('should validate against mvs.ecosystem.schema.json', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = vectors.ecosystemAztec();
    const parsed: unknown = readJson(vecPath);

    expect(isObject(parsed)).toBe(true);
    const data = parsed as Record<string, unknown>;

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);

    if (!res.ok) {
      throw new Error(res.text);
    }
    expect(res.ok).toBe(true);
  });
});
