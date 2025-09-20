// packages/core/src/__tests__/ecosystemVector.emptyArrays.test.ts
// Negative: ecosystem arrays must have at least 1 element.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';
import { stringifyFail } from '../test-helpers/asserts.js';

// Use literal canonical ID to avoid runtime constant issues.
const SCHEMA_ECOSYSTEM = 'urn:zkpip:mvs.ecosystem.schema.json';

function loadJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('Negative: ecosystem arrays must have at least 1 element', () => {
  it('should fail when languages or hashes are empty', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'ecosystem/aztec.json');
    const data = loadJson(vecPath);

    // Force arrays to be empty – schema should reject these.
    (data as Record<string, unknown>)['languages'] = [];
    (data as Record<string, unknown>)['hashes'] = [];

    const res = validateAgainstResult(ajv, SCHEMA_ECOSYSTEM, data);
    expect(res.ok).toBe(false);

    if (!res.ok) {
      const msg = stringifyFail(res as Record<string, unknown> & { ok: boolean });
      expect(msg).toMatch(/languages/i);
      expect(msg).toMatch(/hashes/i);
      expect(msg).toMatch(/must NOT have fewer than 1 items|minItems|at least 1/i);
    }
  });
});
