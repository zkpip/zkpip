import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execaNode } from 'execa';
import { fileURLToPath } from 'node:url';
import type { SealV1 } from '@zkpip/core/seal/v1';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js'); // ✅ from test file → dist/index.js

describe('CLI: vectors sign (Seal v1)', () => {
  it('produces a Seal v1 file with expected fields', async () => {
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

      const sealed = JSON.parse(readFileSync(output, 'utf8')) as SealV1;

      // v1 shape
      expect(sealed.version).toBe('1');
      expect(sealed.kind).toBe('vector');
      expect(sealed).toHaveProperty('body');
      expect(sealed).not.toHaveProperty('vector'); // POC field should not be present

      // seal block (no `id` in v1)
      expect(sealed.seal.algo).toBe('ed25519');
      expect(typeof sealed.seal.signature).toBe('string');
      expect(sealed.seal.urn.startsWith('urn:zkpip:vector:sha256:')).toBe(true);
      expect(typeof sealed.seal.keyId).toBe('string');
      expect(typeof sealed.seal.signer === 'undefined' || sealed.seal.signer.includes('codeseal')).toBe(true);
      expect(typeof sealed.seal.createdAt).toBe('string');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
