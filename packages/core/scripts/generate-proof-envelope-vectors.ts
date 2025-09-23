// packages/core/scripts/generate-proof-envelope-vectors.ts
// Run: npx tsx packages/core/scripts/generate-proof-envelope-vectors.ts

import { mkdirSync } from 'node:fs';
import { writeFileSync } from '#fs-compat';
import { join, resolve } from 'node:path';

const FIX_DIR   = resolve('fixtures/snarkjs-groth16/valid');
const VKEY_PATH = join(FIX_DIR, 'verification.json');
const PROOF     = join(FIX_DIR, 'proof.json');
const PUBLICS   = join(FIX_DIR, 'public.json');

const OUT_DIR = resolve('packages/core/schemas/tests/vectors/mvs/proof-envelope/snarkjs-groth16/valid');

function makeEnvelope(
  envelopeId: string,
  curve: 'bn128' | 'bn254',
  proverVersion: string
) {
  // Build a minimal valid ProofEnvelope (artifacts branch)
  return {
    envelopeId,
    schemaVersion: '0.1.0',
    proofSystem: 'groth16',
    curve,
    prover: { name: 'snarkjs', version: proverVersion },
    program: { language: 'circom', name: 'example' },
    artifacts: {
      vkey:          { path: VKEY_PATH },
      proof:         { path: PROOF },
      publicSignals: { path: PUBLICS }
    }
  } as const;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const env1 = makeEnvelope('urn:uuid:00000000-0000-4000-8000-000000000001', 'bn128', '0.7.x');
  const env2 = makeEnvelope('urn:uuid:00000000-0000-4000-8000-000000000002', 'bn254', '0.8.x');
  const env3 = makeEnvelope('urn:uuid:00000000-0000-4000-8000-000000000003', 'bn128', '0.7.x');

  writeFileSync(join(OUT_DIR, 'proof-envelope.valid-1.json'), JSON.stringify(env1, null, 2), 'utf8');
  writeFileSync(join(OUT_DIR, 'proof-envelope.valid-2.json'), JSON.stringify(env2, null, 2), 'utf8');
  writeFileSync(join(OUT_DIR, 'proof-envelope.valid-3.json'), JSON.stringify(env3, null, 2), 'utf8');

  console.log('Wrote 3 valid vectors into:', OUT_DIR);
}

main();
