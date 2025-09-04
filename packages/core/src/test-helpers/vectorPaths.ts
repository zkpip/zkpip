import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Try multiple candidates so this works both before/after refactors and in CI. */
function resolveMvsRoot(): string {
  const candidates = [
    // current layout: helper at packages/core/src/test-helpers → go up 2 → core/
    path.resolve(__dirname, '../../schemas/tests/vectors/mvs'),
    // legacy when helper lived under __tests__/helpers → go up 3 → packages/
    path.resolve(__dirname, '../../../schemas/tests/vectors/mvs'),
    // workspace fallback from repo root
    path.resolve(process.cwd(), 'packages/core/schemas/tests/vectors/mvs'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Helpful error for CI logs
  throw new Error('MVS_ROOT not found. Tried:\n' + candidates.map((p) => ` - ${p}`).join('\n'));
}

export const MVS_ROOT = resolveMvsRoot();

function pickPath(newRel: string, legacyRel?: string): string {
  const pNew = path.join(MVS_ROOT, newRel);
  if (fs.existsSync(pNew)) return pNew;

  if (legacyRel) {
    const pOld = path.join(MVS_ROOT, legacyRel);
    if (fs.existsSync(pOld)) return pOld;
  }
  const tried = [`mvs/${newRel}`].concat(legacyRel ? [`mvs/${legacyRel}`] : []);
  throw new Error(`Vector not found. Tried: ${tried.join(' | ')}`);
}

export const vectors = {
  ecosystemAztec: () => pickPath('ecosystem/aztec.json', 'ecosystem-aztec.json'),
  groth16Valid: () =>
    pickPath('verification/groth16-evm.valid.json', 'verification-groth16-evm.json'),
  groth16Invalid: () =>
    pickPath('verification/groth16-evm.invalid.json', 'verification-groth16-evm.invalid.json'),
  issuePublicInputOrder: () =>
    pickPath('issue/public-input-order.json', 'issue-public-input-order.json'),
};

export function readJson(absPath: string): unknown {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}
