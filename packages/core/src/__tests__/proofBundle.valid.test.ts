// packages/core/src/__tests__/proofBundle.valid.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '../index.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT, readJson } from '../test-helpers/vectorPaths.js';

/** Collect valid proofBundle vectors from the new layout; fallback to legacy flat files. */
function collectValidProofBundleVectors(): string[] {
  const newDir = path.join(MVS_ROOT, 'verification/proofBundle');
  const legacyDir = MVS_ROOT;

  // Prefer new layout: verification/proofBundle/*.valid.json
  if (fs.existsSync(newDir)) {
    const files = fs
      .readdirSync(newDir)
      .filter((f) => f.toLowerCase().endsWith('.valid.json'))
      .map((f) => path.join(newDir, f));
    if (files.length > 0) return files;
  }

  // Fallback: legacy files like proof-bundle.*.valid.json under mvs/
  const legacyPattern = /^proof-bundle\..*\.valid\.json$/i;
  if (fs.existsSync(legacyDir)) {
    const files = fs
      .readdirSync(legacyDir)
      .filter((f) => legacyPattern.test(f))
      .map((f) => path.join(legacyDir, f));
    if (files.length > 0) return files;
  }

  return [];
}

describe('ProofBundle — VALID vectors', () => {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const files = collectValidProofBundleVectors();

  if (files.length === 0) {
    it.skip('no valid proof-bundle vectors present', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const abs of files) {
    const name = path.basename(abs);
    it(`should accept ${name}`, () => {
      const data = readJson(abs) as Record<string, unknown>;
      const res = validateAgainstResult(ajv, CANONICAL_IDS.proofBundle, data);
      if (!res.ok) throw new Error(res.text);
      expect(res.ok).toBe(true);
    });
  }
});
