// packages/cli/src/__tests__/helpers/canvectors.local.ts
// Reads vectors from the local fixtures folder.
// Supports both layouts:
//  A) fixtures/<fw>-<ps>/<suite>/<validity>/verification.json
//  B) fixtures/<fw>-<ps>/<validity>/verification.json   (no suite level)

import { existsSync, promises as fsp } from 'node:fs';
import { resolve, join } from 'node:path';
import type { VectorId, VectorManifestV1, VectorProvider, ResolvedVector } from './canvectors.types.js';
import { fixturesPath } from './cliRunner.js';

type ResolvedVectorOpt = Omit<ResolvedVector, 'manifest'> & { manifest?: VectorManifestV1 };

function splitId(id: VectorId): {
  fw: string;
  ps: string;
  suite: string;
  validity: 'valid' | 'invalid';
} {
  // can:snarkjs:plonk:add1:valid  -> ["can","snarkjs","plonk","add1","valid"]
  const parts = id.split(':');
  if (parts.length !== 5) throw new Error(`Invalid VectorId format: ${id}`);
  const fw = parts[1]!;
  const ps = parts[2]!;
  const suite = parts[3]!;
  const validity = parts[4] as 'valid' | 'invalid';
  if (validity !== 'valid' && validity !== 'invalid') {
    throw new Error(`Invalid validity in VectorId: ${id}`);
  }
  return { fw, ps, suite, validity };
}

export class LocalFsProvider implements VectorProvider {
  async resolve(input: VectorId | VectorManifestV1): Promise<ResolvedVector> {
    const id = typeof input === 'string' ? input : input.id;
    const { fw, ps, suite, validity } = splitId(id);

    // Candidate A: with suite level
    const relWithSuite = join(`${fw}-${ps}`, suite, validity, 'verification.json');
    const absWithSuite = fixturesPath(relWithSuite);

    // Candidate B: flat layout (no suite level)
    const relFlat = join(`${fw}-${ps}`, validity, 'verification.json');
    const absFlat = fixturesPath(relFlat);

    // Pick the first existing candidate
    const abs = existsSync(absWithSuite) ? absWithSuite : existsSync(absFlat) ? absFlat : undefined;
    if (!abs) {
      const cwdFx = resolve(process.cwd(), 'fixtures');
      const msg = [
        `LocalFsProvider: verification.json not found for id=${id}`,
        `Tried:`,
        ` - ${absWithSuite}`,
        ` - ${absFlat}`,
        `fixtures cwd was: ${cwdFx}`,
      ].join('\n');
      throw new Error(msg);
    }

    const buf = await fsp.readFile(abs, 'utf8');
    const verificationJson = JSON.parse(buf) as unknown;

    const base = { id, verificationJson } as const;
    const rv: ResolvedVectorOpt = typeof input === 'string' ? base : { ...base, manifest: input };
    return rv;
  }
}
