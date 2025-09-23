// packages/core/src/__tests__/compileCoreSchemas.test.ts
// Ensure all core schemas are loaded and registered under their canonical $id.

import { describe, it, expect } from 'vitest';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';

const CANONICAL_IDS_LIST: readonly string[] = [
  'urn:zkpip:mvs.verification.schema.json',
  'urn:zkpip:mvs.core.schema.json',
  'urn:zkpip:mvs.cir.schema.json',
  'urn:zkpip:mvs.issue.schema.json',
  'urn:zkpip:mvs.ecosystem.schema.json',
  'urn:zkpip:mvs.proofEnvelope.schema.json',
];

describe('Core schemas compile', () => {
  it('should load and register all core schemas with canonical $id', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    for (const id of CANONICAL_IDS_LIST) {
      const maybe = ajv.getSchema(id);
      if (!maybe) {
        console.error(`Schema not registered: ${id}`);
      }
      expect(maybe, `missing AJV schema for ${id}`).toBeTruthy();
    }
  });
});
