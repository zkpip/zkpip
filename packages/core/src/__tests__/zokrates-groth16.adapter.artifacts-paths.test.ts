import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { importCliAdapter, resolveExtract } from '../test-helpers/adapterImport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function firstExisting(baseDir: string, names: readonly string[]): string {
  for (const n of names) {
    const p = join(baseDir, n);
    if (existsSync(p)) return p;
  }
  return join(baseDir, names[0]);
}

describe('adapter: zokrates-groth16 — artifacts.{vkey,proof,publicSignals}.path', () => {
  it('loads triplet from individual ArtifactRef.path files', async () => {
    const VEC_ROOT = resolve(
      __dirname,
      '../../schemas/tests/vectors/mvs/verification/zokrates-groth16/valid',
    );
    const vkeyPath = firstExisting(VEC_ROOT, ['verification.key', 'verification_key.json', 'verification.json']);
    const proofPath = firstExisting(VEC_ROOT, ['proof.json']);
    const publicsPath = firstExisting(VEC_ROOT, ['public.json']);

    expect(() => readFileSync(vkeyPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(proofPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(publicsPath, 'utf8')).not.toThrow();

    const envelope = { artifacts: { vkey: { path: vkeyPath }, proof: { path: proofPath }, publicSignals: { path: publicsPath } } };

    const mod = await importCliAdapter('zokrates-groth16');
    const extractTriplet = resolveExtract(mod);
    expect(Boolean(extractTriplet), 'missing export: extractTriplet').toBe(true);

    const out = extractTriplet!(envelope);
    expect(typeof out.verificationKey).toBe('object');
    expect(typeof out.proof).toBe('object');
    expect(Array.isArray(out.publics) && out.publics.every((x) => typeof x === 'string')).toBe(true);
  });
});
