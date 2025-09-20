import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { importCliAdapter, resolveExtract } from '../test-helpers/adapterImport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('adapter: snarkjs-plonk — artifacts.{vkey,proof,publicSignals}.path', () => {
  it('loads triplet from individual ArtifactRef.path files (proof may be string or object)', async () => {
    const VEC_ROOT = resolve(
      __dirname,
      '../../schemas/tests/vectors/mvs/verification/snarkjs-plonk/valid',
    );
    const vkeyPath = join(VEC_ROOT, 'verification_key.json');
    const proofPath = join(VEC_ROOT, 'proof.json');
    const publicsPath = join(VEC_ROOT, 'public.json');

    expect(() => readFileSync(vkeyPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(proofPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(publicsPath, 'utf8')).not.toThrow();

    const envelope = { artifacts: { vkey: { path: vkeyPath }, proof: { path: proofPath }, publicSignals: { path: publicsPath } } };

    const mod = await importCliAdapter('snarkjs-plonk');
    const extractTriplet = resolveExtract(mod);
    expect(Boolean(extractTriplet), 'missing export: extractTriplet').toBe(true);

    const out = extractTriplet!(envelope);
    expect(typeof out.verificationKey).toBe('object');
    expect(typeof out.proof === 'string' || typeof out.proof === 'object').toBe(true);
    expect(Array.isArray(out.publics) && out.publics.every((x) => typeof x === 'string')).toBe(true);
  });
});
