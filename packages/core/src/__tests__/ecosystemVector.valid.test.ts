// packages/core/src/__tests__/ecosystemVector.valid.test.ts
// Positive validation test for the ecosystem vector.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';
import { stringifyFail } from '../test-helpers/asserts.js';

// Use a literal canonical ID to avoid runtime constant issues.
const SCHEMA_ECOSYSTEM = 'urn:zkpip:mvs.ecosystem.schema.json';

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('Vector: ecosystem/aztec.json', () => {
  it('should validate against mvs.ecosystem.schema.json', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'ecosystem/aztec.json');
    const data = loadJson(vecPath);

    const res = validateAgainstResult(ajv, SCHEMA_ECOSYSTEM, data);
    if (!res.ok) {
      console.error('Validation failed:', stringifyFail(res));
    }
    expect(res.ok).toBe(true);
  });
});
