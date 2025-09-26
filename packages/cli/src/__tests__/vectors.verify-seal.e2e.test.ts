// packages/cli/src/__tests__/vectors.verify-seal.e2e.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaNode } from 'execa';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js');

describe('CLI: vectors verify-seal (CodeSeal POC)', () => {
  it('sign → verify-seal passes', async () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-e2e-'));
    try {
      const input = join(base, 'in.json');
      const sealed = join(base, 'sealed.json');
      const keyDir = join(base, 'keys');
      writeFileSync(input, JSON.stringify({ a: 1, b: 2 }), 'utf8');

      await execaNode(cliDist, ['vectors', 'sign', '--in', input, '--out', sealed, '--key-dir', keyDir],
        { env: { ZKPIP_HARD_EXIT: '0' }, stdio: 'pipe' });

      const r = await execaNode(cliDist, ['vectors', 'verify-seal', '--in', sealed, '--key-dir', keyDir],
        { env: { ZKPIP_HARD_EXIT: '0' }, stdio: 'pipe', reject: false });

      expect(r.exitCode).toBe(0);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
