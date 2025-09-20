// packages/core/src/__tests__/ecosystemVector.invalid.test.ts
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';

// Use a literal canonical ID to avoid runtime constant issues.
const SCHEMA_ECOSYSTEM = 'urn:zkpip:mvs.ecosystem.schema.json';

function load(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('Negative: ecosystem/aztec.json (missing required field)', () => {
  it('should fail when schemaVersion is removed', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'ecosystem/aztec.json');
    const data = load(vecPath);
    delete (data as { schemaVersion?: unknown }).schemaVersion;

    const res = validateAgainstResult(ajv, SCHEMA_ECOSYSTEM, data);
    expect(res.ok).toBe(false);

    // Build a helpful message regardless of the error payload shape
    if (!res.ok) {
      // Some implementations return { ok:false, errors: AjvError[] }, others { ok:false, text:string }
      const msg =
        ('errors' in res && Array.isArray((res as unknown as { errors: unknown[] }).errors))
          ? JSON.stringify((res as { errors: unknown[] }).errors)
          : String((res as { text?: string }).text ?? '');

      expect(msg).toMatch(/required property 'schemaVersion'|must have required property 'schemaVersion'/i);
    }
  });
});
