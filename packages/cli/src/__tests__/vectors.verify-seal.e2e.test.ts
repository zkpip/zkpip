import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaNode } from 'execa';
import { verify as nodeVerify } from 'node:crypto';
import { prepareBodyDigest, type SealV1 } from '@zkpip/core/seal/v1';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js');

describe('CLI: vectors verify-seal (Seal v1, module-level verify)', () => {
  it('sign → Core-based verify passes (URN & signature)', async () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-e2e-'));
    try {
      const input = join(base, 'in.json');
      const sealedPath = join(base, 'sealed.json');
      const keyDir = join(base, 'keys');

      writeFileSync(input, JSON.stringify({ a: 1, b: 2 }), 'utf8');

      // 1) Sign with CLI (v1 output)
      const signRes = await execaNode(
        cliDist,
        ['vectors', 'sign', '--in', input, '--out', sealedPath, '--key-dir', keyDir],
        { env: { ZKPIP_HARD_EXIT: '0' }, stdio: 'pipe' }
      );
      expect(signRes.exitCode).toBe(0);

      // 2) Load sealed & recompute URN using core helper
      const sealed = JSON.parse(readFileSync(sealedPath, 'utf8')) as SealV1;
      expect(sealed.version).toBe('1');
      const { canon, expectedUrn } = prepareBodyDigest({ body: sealed.body, kind: sealed.kind });

      // URN must match
      expect(sealed.seal.urn).toBe(expectedUrn);

      // 3) Verify Ed25519 signature against canon using generated public key
      const pubPemPath = join(keyDir, 'public.pem'); // signer writes keys directly into keyDir
      const publicPem = readFileSync(pubPemPath, 'utf8');

      // base64 sanity (should be valid)
      const sigB64 = sealed.seal.signature;
      const sigBuf = Buffer.from(sigB64, 'base64');
      expect(sigBuf.length > 0 && sigBuf.toString('base64') === sigB64).toBe(true);

      const ok = nodeVerify(null, Buffer.from(canon, 'utf8'), publicPem, sigBuf);
      expect(ok).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
