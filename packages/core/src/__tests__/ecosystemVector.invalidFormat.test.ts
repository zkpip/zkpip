// packages/core/src/__tests__/ecosystemVector.invalidFormat.test.ts
// Negative validation tests for ecosystem vector: invalid date-time fields.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';
import { stringifyFail } from '../test-helpers/asserts.js';

// Use a literal canonical ID to avoid runtime constant/circular issues.
const SCHEMA_ECOSYSTEM = 'urn:zkpip:mvs.ecosystem.schema.json';

function loadJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('Negative: ecosystem createdAt/updatedAt invalid format', () => {
  it('should fail when createdAt is not a valid date-time', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'ecosystem/aztec.json');
    const data = loadJson(vecPath);
    (data as Record<string, unknown>)['createdAt'] = 'INVALID_DATE';

    const res = validateAgainstResult(ajv, SCHEMA_ECOSYSTEM, data);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const msg = stringifyFail(res as Record<string, unknown> & { ok: boolean });
      expect(msg).toMatch(/createdAt/i);
      expect(msg).toMatch(/date-time/i);
    }
  });

  it('should fail when updatedAt is not a valid date-time', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'ecosystem/aztec.json');
    const data = loadJson(vecPath);
    (data as Record<string, unknown>)['updatedAt'] = 'NOT_A_TIMESTAMP';

    const res = validateAgainstResult(ajv, SCHEMA_ECOSYSTEM, data);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const msg = stringifyFail(res as Record<string, unknown> & { ok: boolean });
      expect(msg).toMatch(/updatedAt/i);
      expect(msg).toMatch(/date-time/i);
    }
  });
});
