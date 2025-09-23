// Positive validation tests for known vectors.
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';

// Use a literal canonical ID to avoid runtime constant issues.
const SCHEMA_VERIFICATION = 'urn:zkpip:mvs.verification.schema.json';

function load(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('Vector: verification/groth16-evm.valid.json', () => {
  it('should validate against mvs.verification.schema.json', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'verification/groth16-evm.valid.json');
    const data = load(vecPath);

    const res = validateAgainstResult(ajv, SCHEMA_VERIFICATION, data);
    if (!res.ok) {
      const msg =
        ('errors' in res && Array.isArray((res as unknown as { errors: unknown[] }).errors))
          ? JSON.stringify((res as { errors: unknown[] }).errors)
          : String((res as { text?: string }).text ?? '');
      console.error('Validation failed:', msg);
    }
    expect(res.ok).toBe(true);
  });
});
