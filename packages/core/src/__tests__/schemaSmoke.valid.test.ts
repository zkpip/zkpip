// packages/core/src/__tests__/schemaSmoke.valid.test.ts
import { describe, it, expect } from 'vitest';
import { createAjv, addCoreSchemas } from '../index.js';

describe('Core Schemas Smoke', () => {
  it('loads core schemas and exposes legacy and subpath aliases', () => {
    const ajv = createAjv();

    // Should not throw while registering core schemas
    expect(() => addCoreSchemas(ajv)).not.toThrow();

    // Legacy flat aliases (kept for backward-compat)
    expect(ajv.getSchema('mvs/proof-envelope')).toBeTruthy();
    expect(ajv.getSchema('mvs/cir')).toBeTruthy();

    // New subpath aliases reflecting the folder layout
    expect(ajv.getSchema('mvs/verification/proofEnvelope')).toBeTruthy();
    expect(ajv.getSchema('mvs/verification/cir')).toBeTruthy();
  });
});
