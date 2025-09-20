// DEPRECATED

// packages/core/src/__tests__/proofEnvelope.invalid.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '../index.js';
import { validateAgainstResult } from '../testing/ajv-helpers.js';
import { MVS_ROOT, readJson } from '../test-helpers/vectorPaths.js';

/** Collect invalid proofEnvelope vectors from the new layout; fallback to legacy flat files. */
function collectInvalidProofEnvelopeVectors(): string[] {
  const newDir = path.join(MVS_ROOT, 'verification/proofEnvelope');
  const legacyDir = MVS_ROOT; // legacy flat files lived under mvs/

  // Prefer new layout: verification/proofEnvelope/*.invalid.json
  if (fs.existsSync(newDir)) {
    const files = fs
      .readdirSync(newDir)
      .filter((f) => f.toLowerCase().endsWith('.invalid.json'))
      .map((f) => path.join(newDir, f));
    if (files.length > 0) return files;
  }

  // Fallback: legacy files like proof-envelope.*.invalid.json under mvs/
  const legacyPattern = /^proof-envelope\..*\.invalid\.json$/i;
  if (fs.existsSync(legacyDir)) {
    const files = fs
      .readdirSync(legacyDir)
      .filter((f) => legacyPattern.test(f))
      .map((f) => path.join(legacyDir, f));
    if (files.length > 0) return files;
  }

  return [];
}

describe('ProofEnvelope — INVALID vectors', () => {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const files = collectInvalidProofEnvelopeVectors();

  if (files.length === 0) {
    it.skip('no invalid proof-envelope vectors present', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const abs of files) {
    const name = path.basename(abs);
    it(`should reject ${name}`, () => {
      const data = readJson(abs) as Record<string, unknown>;
      const res = validateAgainstResult(ajv, CANONICAL_IDS.proofEnvelope, data);
      expect(res.ok).toBe(false);
    });
  }
});
