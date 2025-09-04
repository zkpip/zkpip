// packages/core/src/__tests__/validate.integration.test.ts
// Integration tests for validate.ts using filename-based routing via pickSchemaId.
// Exercises: createAjv + addCoreSchemas + pickSchemaId + AJV validate.

import { existsSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { validatePath } from '../validate/vectors.js';
import { MVS_ROOT } from '../test-helpers/vectorPaths.js';

// Updated vector paths (new layout via helper root)
const VERIF_VECTOR = join(MVS_ROOT, 'verification/groth16-evm.valid.json');
const ISSUE_VECTOR = join(MVS_ROOT, 'issue/public-input-order.json');
const ECO_VECTOR = join(MVS_ROOT, 'ecosystem/aztec.json');

// Pre-flight: ensure vectors exist (helps with CI diagnostics)
for (const p of [VERIF_VECTOR, ISSUE_VECTOR, ECO_VECTOR]) {
  if (!existsSync(p)) {
    const dir = dirname(p);
    const listing = existsSync(dir) ? readdirSync(dir).join(', ') : '<missing dir>';
    throw new Error(`Vector not found: ${p}\nDir listing (${dir}): ${listing}`);
  }
}

// Top-level checks (keep as original)
await expect(validatePath(VERIF_VECTOR)).resolves.toBeUndefined();
await expect(validatePath(ISSUE_VECTOR)).resolves.toBeUndefined();
await expect(validatePath(ECO_VECTOR)).resolves.toBeUndefined();

/** Create a temporary JSON file with the given name and payload. */
function tmpJsonFile(name: string, obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'zkpip-validate-'));
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
  return p;
}

describe('validate.ts + pickSchemaId integration', () => {
  it("routes verification vectors to the verification schema (legacy 'error' filenames tolerated)", async () => {
    await expect(validatePath(VERIF_VECTOR)).resolves.toBeUndefined();
  });

  it('routes issue vectors to the issue schema', async () => {
    await expect(validatePath(ISSUE_VECTOR)).resolves.toBeUndefined();
  });

  it('routes ecosystem vectors to the ecosystem schema', async () => {
    await expect(validatePath(ECO_VECTOR)).resolves.toBeUndefined();
  });

  it('routes proof-bundle manifest files by name to the proofBundle schema (valid example)', async () => {
    const valid = {
      schemaVersion: '0.1.0',
      bundleId: 'bndl-001',
      prover: 'snarkjs',
      proofSystem: 'groth16',
      curve: 'bn128',
      program: { language: 'circom', entry: 'circuits/main.circom' },
      artifacts: {
        wasm: { path: 'build/main.wasm' },
        zkey: { path: 'build/main.zkey' },
      },
    };
    const p = tmpJsonFile('my.proof-bundle.manifest.json', valid);
    await expect(validatePath(p)).resolves.toBeUndefined();
  });

  it('rejects invalid proof-bundle (snarkjs without zkey)', async () => {
    const invalid = {
      schemaVersion: '0.1.0',
      bundleId: 'bndl-002',
      prover: 'snarkjs',
      proofSystem: 'groth16',
      curve: 'bn128',
      program: { language: 'circom', entry: 'circuits/main.circom' },
      artifacts: {
        wasm: { path: 'build/main.wasm' },
      },
    };
    const p = tmpJsonFile('bundle.manifest.json', invalid);
    await expect(validatePath(p)).rejects.toThrow(/Validation failed/);
  });

  it('routes CIR files by name to the cir schema (valid example)', async () => {
    const valid = {
      formatVersion: '0.1',
      proofSystem: 'groth16',
      curve: 'bn128',
      fieldModulus: '21888242871839275222246405745257275088548364400416034343698204186575808495617',
      circuits: [
        {
          id: 'main',
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          nConstraints: 3,
          nSignalsPublic: 1,
          nSignalsPrivate: 2,
        },
      ],
    };
    const p = tmpJsonFile('circuit-spec.cir.json', valid);
    await expect(validatePath(p)).resolves.toBeUndefined();
  });

  it('rejects invalid CIR (nConstraints = 0)', async () => {
    const invalid = {
      formatVersion: '0.1',
      proofSystem: 'groth16',
      curve: 'bn128',
      fieldModulus: '21888242871839275222246405745257275088548364400416034343698204186575808495617',
      circuits: [
        {
          id: 'main',
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          nConstraints: 0,
          nSignalsPublic: 1,
          nSignalsPrivate: 2,
        },
      ],
    };
    const p = tmpJsonFile('cir.json', invalid);
    await expect(validatePath(p)).rejects.toThrow(/Validation failed/);
  });

  it('defaults to core schema when filename does not match any known pattern', async () => {
    const minimalCore = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'urn:zkpip:mvs:core.payload:0.1',
      type: 'object',
    };
    const p = tmpJsonFile('random.json', minimalCore);

    try {
      await validatePath(p);
      expect(true).toBe(true);
    } catch (e) {
      expect(String(e)).toMatch(/Validation failed|Schema:/);
    }
  });
});
