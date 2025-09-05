// packages/core/src/__tests__/proofSet.invalid.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '../index.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT, readJson } from '../test-helpers/vectorPaths.js';

/** Collect invalid proofSet vectors from the new layout; fallback to legacy flat files. */
function collectInvalidProofSetVectors(): string[] {
  const newDir = path.join(MVS_ROOT, 'verification/proofSet');
  const legacyDir = MVS_ROOT; // legacy flat files lived under mvs/

  // Prefer new layout: verification/proofSet/*.invalid.json
  if (fs.existsSync(newDir)) {
    const files = fs
      .readdirSync(newDir)
      .filter((f) => f.toLowerCase().endsWith('.invalid.json'))
      .map((f) => path.join(newDir, f));
    if (files.length > 0) return files;
  }

  // Fallback: legacy files like proof-set.*.invalid.json under mvs/
  const legacyPattern = /^proof-set\..*\.invalid\.json$/i;
  if (fs.existsSync(legacyDir)) {
    const files = fs
      .readdirSync(legacyDir)
      .filter((f) => legacyPattern.test(f))
      .map((f) => path.join(legacyDir, f));
    if (files.length > 0) return files;
  }

  return [];
}

describe('ProofSet — INVALID vectors', () => {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const files = collectInvalidProofSetVectors();

  if (files.length === 0) {
    it.skip('no invalid proof-set vectors present', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const abs of files) {
    const name = path.basename(abs);
    it(`should reject ${name}`, () => {
      const data = readJson(abs) as Record<string, unknown>;
      const res = validateAgainstResult(ajv, CANONICAL_IDS.proofSet, data);
      expect(res.ok).toBe(false);
    });
  }
});
