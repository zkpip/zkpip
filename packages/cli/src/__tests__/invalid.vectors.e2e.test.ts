// ESM, strict TS. No "any".
// Runs the CLI verify against all invalid vectors and expects exit code 1.

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { execaNode } from 'execa';
import { fileURLToPath } from 'node:url';

function* walkJson(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walkJson(p);
    else if (name.endsWith('.json')) yield p;
  }
}

function cliBin(): string {
  // Adjust if your dist path differs
  const here = fileURLToPath(new URL('.', import.meta.url));
  return resolve(here, '..', 'dist', 'index.js');
}

describe('invalid vectors (CLI verify should fail)', () => {
  const repoRoot = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
  const base = resolve(
    repoRoot,
    'packages/core/schemas/tests/vectors/mvs/verification',
  );

  const invalidRoots = [
    join(base, 'snarkjs-groth16', 'invalid'),
    join(base, 'snarkjs-plonk', 'invalid'),
    join(base, 'zokrates-groth16', 'invalid'),
  ];

  for (const root of invalidRoots) {
    for (const f of walkJson(root)) {
      const rel = relative(repoRoot, f);
      it(`fails: ${rel}`, async () => {
        const bin = cliBin();
        const { exitCode, stdout, stderr } = await execaNode(
          bin,
          [
            'verify',
            '--adapter',
            // naive adapter infer from path; change if you store adapters elsewhere
            rel.includes('snarkjs-groth16') ? 'snarkjs-groth16'
            : rel.includes('snarkjs-plonk') ? 'snarkjs-plonk'
            : 'zokrates-groth16',
            '--verification',
            f,
            '--json',
            '--use-exit-codes',
          ],
          { reject: false },
        );

        // Expect non-zero; show some output for debugging
        expect(exitCode, `stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(1);
      });
    }
  }
});
