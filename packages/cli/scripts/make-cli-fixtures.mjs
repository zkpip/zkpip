// packages/cli/scripts/make-cli-fixtures.mjs
// Compose CLI fixtures/…/verification.json from core vectors so CI is stable.
// - No hard process.exit(); entry sets process.exitCode
// - English comments for OSS clarity.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExitCode } from './utils/exit-codes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');

/** Read & parse JSON file safely. */
async function loadJson(p) {
  const txt = await readFile(p, 'utf8');
  return JSON.parse(txt);
}

/**
 * Build one verification.json for snarkjs-plonk.
 * @param {'valid'|'invalid'} which
 */
async function buildPlonk(which) {
  const base = join(
    repoRoot,
    'packages/core/schemas/tests/vectors/mvs/verification/snarkjs-plonk',
    which,
  );

  const [proof, publics, vkey] = await Promise.all([
    loadJson(join(base, 'proof.json')),
    loadJson(join(base, 'public.json')),
    loadJson(join(base, 'verification_key.json')),
  ]);

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
  // Pretty-print for readable diffs in CI; change to null,0 if you prefer compact
  await writeFile(join(outDir, 'verification.json'), JSON.stringify(outObj, null, 2), 'utf8');

  // Tiny sanity note (stdout, not stderr)
  process.stdout.write(`[fixtures] wrote snarkjs-plonk/${which}/verification.json\n`);
}

/**
 * Main orchestrator. Returns an ExitCode, does not exit the process.
 * @returns {Promise<number>}
 */
async function main() {
  try {
    await buildPlonk('valid');
    await buildPlonk('invalid');
    return ExitCode.OK;
  } catch (err) {
    const note =
      '[fixtures] generation failed: ' + (err && err.message ? err.message : String(err));
    console.error(note);
    return ExitCode.IO_ERROR;
  }
}

// ── Entry point: the only place that touches process.exitCode ──────────────────
const code = await main();
process.exitCode = code;
