// packages/core/src/__tests__/issueVector.valid.test.ts
// Positive validation test for the issue vector.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';
import { stringifyFail } from '../test-helpers/asserts.js';

// Use a literal canonical ID to avoid runtime constant issues.
const SCHEMA_ISSUE = 'urn:zkpip:mvs.issue.schema.json';

function loadJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('Vector: issue/public-input-order.json', () => {
  it('should validate against mvs.issue.schema.json', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'issue/public-input-order.json');
    const data = loadJson(vecPath);

    const res = validateAgainstResult(ajv, SCHEMA_ISSUE, data);
    if (!res.ok) {
      // test
      console.error('Validation failed:', stringifyFail(res));
    }
    expect(res.ok).toBe(true);
  });
});
