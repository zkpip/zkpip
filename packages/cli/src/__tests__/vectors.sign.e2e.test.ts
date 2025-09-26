// packages/cli/src/__tests__/vectors.sign.e2e.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execaNode } from 'execa';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js'); // ✅ from test file → dist/index.js

describe('CLI: vectors sign (CodeSeal POC)', () => {
  it('produces sealed file with CodeSeal fields', async () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-e2e-'));
    try {
      const input = join(base, 'in.json');
      const output = join(base, 'out.sealed.json');
      const keyDir = join(base, 'keys');

      writeFileSync(input, JSON.stringify({ b: 1, a: 2 }), 'utf8');

      const res = await execaNode(
        cliDist,
        ['vectors', 'sign', '--in', input, '--out', output, '--key-dir', keyDir],
        { stdio: 'pipe', env: { ZKPIP_HARD_EXIT: '0' } } // avoid hard exit in tests
      );
      expect(res.exitCode).toBe(0);

      const sealed = JSON.parse(readFileSync(output, 'utf8')) as {
        vector: Record<string, unknown>;
        seal: { signer: string; urn: string; algo: string; id: string };
      };
      expect(sealed.seal.signer).toContain('codeseal');
      expect(sealed.seal.algo).toBe('ed25519');
      expect(sealed.seal.urn.startsWith('urn:zkpip:vector:sha256:')).toBe(true);
      expect(typeof sealed.seal.id).toBe('string');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
