// packages/core/src/__tests__/cir.valid.test.ts
// CIR — VALID vectors should pass against the canonical cir schema.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';
import { stringifyFail } from '../test-helpers/asserts.js';

// Use literal canonical ID to avoid runtime constant issues.
const SCHEMA_CIR = 'urn:zkpip:mvs.cir.schema.json';

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('CIR — VALID vectors', () => {
  it('should accept cir-1.valid.json, cir-2.valid.json, cir-3.valid.json, cir.valid.json', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const cirDir = path.join(MVS_ROOT, 'verification/cir');
    const files = readdirSync(cirDir).filter((f) => /\.valid\.json$/i.test(f));

    // Sanity: ensure we actually picked up the expected files
    expect(files.length > 0, 'no CIR valid vectors found').toBe(true);

    for (const f of files) {
      const abs = path.join(cirDir, f);
      const data = readJson(abs) as Record<string, unknown>;

      const res = validateAgainstResult(ajv, SCHEMA_CIR, data);
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error(`[CIR] ${f} failed:\n${stringifyFail(res as Record<string, unknown> & { ok: boolean })}`);
      }
      expect(res.ok, `CIR vector failed: ${f}`).toBe(true);
    }
  });
});
