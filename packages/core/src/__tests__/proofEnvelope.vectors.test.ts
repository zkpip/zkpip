// packages/core/src/__tests__/proofEnvelope.vectors.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAjv } from '../validation/createAjv.js';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vectors root according to repo layout
const VECTORS_ROOT = resolve(
  __dirname,
  '../../schemas/tests/vectors/mvs/proof-envelope/snarkjs-groth16',
);

// Use the canonical colon-form schema id (matches the schema file's $id)
const SCHEMA_ID = 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json';

function loadJson(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function compileValidator() {
  const ajv = createAjv();
  addCoreSchemas(ajv);
  const validate =
    ajv.getSchema(SCHEMA_ID) ??
    ajv.compile({ $ref: SCHEMA_ID });
  return validate;
}

describe('ProofEnvelope v1 vectors — snarkjs-groth16', () => {
  const validate = compileValidator();

  it('valid vectors pass', () => {
    const dir = join(VECTORS_ROOT, 'valid');
    expect(existsSync(dir)).toBe(true);

    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);

    for (const f of files) {
      const fp = join(dir, f);
      const data = loadJson(fp);
      const ok = validate(data);
      if (!ok) {
        // eslint-disable-next-line no-console
        console.error(`[ProofEnvelope valid] ${f} failed:`, validate.errors);
      }
      expect(ok).toBe(true);
    }
  });

  it('invalid vectors fail', () => {
    const dir = join(VECTORS_ROOT, 'invalid');
    // If the invalid set is absent (temporarily), still assert existence,
    // but allow zero files (no-op).
    expect(existsSync(dir)).toBe(true);

    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const fp = join(dir, f);
      const data = loadJson(fp);
      const ok = validate(data);
      if (ok) {
        // eslint-disable-next-line no-console
        console.error(`[ProofEnvelope invalid] ${f} unexpectedly passed`);
      }
      expect(ok).toBe(false);
    }
  });
});
