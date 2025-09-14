// packages/cli/scripts/make-cli-fixtures.mjs
// Compose CLI fixtures/…/verification.json from core vectors so CI is stable.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');

// Helper to load JSON
async function loadJson(p) {
  const txt = await readFile(p, 'utf8');
  return JSON.parse(txt);
}

// Build one verification.json
async function buildPlonk(which /* 'valid' | 'invalid' */) {
  const base = join(
    repoRoot,
    'packages/core/schemas/tests/vectors/mvs/verification/snarkjs-plonk',
    which,
  );

  const proof = await loadJson(join(base, 'proof.json'));
  const publics = await loadJson(join(base, 'public.json'));
  const vkey = await loadJson(join(base, 'verification_key.json'));

  const outObj = {
    framework: 'snarkjs',
    proofSystem: 'plonk',
    artifacts: {
      proof,
      public: publics,
      verification_key: vkey,
    },
  };

  const outDir = join(repoRoot, 'fixtures/snarkjs-plonk', which);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'verification.json'), JSON.stringify(outObj), 'utf8');
  // tiny sanity
  process.stdout.write(`[fixtures] wrote snarkjs-plonk/${which}/verification.json\n`);
}

async function main() {
  await buildPlonk('valid');
  await buildPlonk('invalid');
}

main().catch((err) => {
  console.error('[fixtures] generation failed:', err?.message || err);
  process.exit(1);
});
