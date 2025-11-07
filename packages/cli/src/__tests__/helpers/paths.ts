// packages/cli/src/__tests__/helpers/paths.ts
// Centralize fixtures and sample vectors.


import { fileURLToPath } from 'node:url';
import path from 'node:path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');


export const fixtures = Object.freeze({
// Provide real, stable files that exist in the repo.
validVector: path.join(repoRoot, 'samples', 'valid.vector.json'),
invalidVector: path.join(repoRoot, 'samples', 'invalid.vector.json'),
sealedSample: path.join(repoRoot, 'samples', 'sealed.json'),
keyDir: path.join(repoRoot, 'samples', 'keys'),
});