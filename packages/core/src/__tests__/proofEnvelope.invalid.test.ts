// DEPRECATED

// packages/core/src/__tests__/proofEnvelope.invalid.test.ts
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';

// Use literal canonical IDs in tests to avoid relying on runtime constants.
const SCHEMA_ECOSYSTEM = 'urn:zkpip:mvs.ecosystem.schema.json';

function load(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('Negative: ecosystem/aztec.json (missing required field)', () => {
  it('should fail when schemaVersion is removed', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = join(MVS_ROOT, 'ecosystem/aztec.json');
    const data = load(vecPath) as Record<string, unknown>;
    delete (data as { schemaVersion?: unknown }).schemaVersion;

    const res = validateAgainstResult(ajv, SCHEMA_ECOSYSTEM, data);
    expect(res.ok).toBe(false);

    if (!res.ok) {
      // Accept both shapes: { ok:false, errors?: AjvError[] } OR { ok:false, text?: string }
      type AjvErr = { instancePath?: string; message?: string };
      type Fail = { ok: false; errors?: AjvErr[]; text?: string };

      const fail = res as Fail;
      const merged =
        Array.isArray(fail.errors) && fail.errors.length > 0
          ? fail.errors.map(e => `${e.instancePath ?? ''}: ${e.message ?? ''}`).join('\n')
          : String(fail.text ?? '');

      expect(merged).toMatch(/must have required property 'schemaVersion'/i);
    }
  });
});
