// packages/cli/src/__tests__/vectors.verify-seal.tamper.v1.test.ts
// Vitest tamper tests for `verifySealV1` (Seal v1)
// - English comments, strict TS, no `any`
// - Generates an ephemeral Ed25519 keypair, writes public.pem into a temp keystore dir
// - Builds a valid sealed body, then tampers various fields and asserts specific errors

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { generateKeyPairSync, sign as nodeSign } from 'node:crypto';

import { canonicalize, sha256Hex, toVectorUrn, type JsonValue } from '@zkpip/core/json/c14n';
import type { SealV1 } from '@zkpip/core/seal/v1';
import verifySealV1, { type Options } from '../commands/verifySeal.js';

// ---------- helpers ----------
function createKeystore(): { keyDir: string; keyId: string; privPem: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'zkpip-key-'));
  const keyId = path.basename(dir);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  // simplest path the verifier tries first: <keyDir>/public.pem
  writeFileSync(path.join(dir, 'public.pem'), pubPem, 'utf8');
  return { keyDir: dir, keyId, privPem };
}

function signCanonEd25519(canon: string, privPem: string): string {
  const sig = nodeSign(null, Buffer.from(canon, 'utf8'), privPem);
  return sig.toString('base64');
}

function buildSealed(body: JsonValue, keyId: string, privPem: string): SealV1 {
  const canon = canonicalize(body);
  const idHex = sha256Hex(canon);
  const urn = toVectorUrn(idHex); // kind defaults to 'vector' in our tests
  const signature = signCanonEd25519(canon, privPem);
  return {
    version: '1',
    kind: 'vector',
    body,
    seal: {
      algo: 'ed25519',
      keyId,
      signature,
      urn,
      signer: 'codeseal/1',
      createdAt: new Date().toISOString(),
    },
  } as const;
}

// ---------- test suite ----------
describe('vectors verify-seal — tamper scenarios (Seal v1)', () => {
  const ctx: { keyDir: string; keyId: string; privPem: string } = { keyDir: '', keyId: '', privPem: '' };

  beforeAll(() => {
    const ks = createKeystore();
    ctx.keyDir = ks.keyDir;
    ctx.keyId = ks.keyId;
    ctx.privPem = ks.privPem;
  });

  it('baseline: valid sealed body verifies OK', () => {
    const body: JsonValue = { a: 1, b: 2 };
    const sealed = buildSealed(body, ctx.keyId, ctx.privPem);
    const res = verifySealV1(sealed, { keyDir: ctx.keyDir } satisfies Options);
    expect(res).toEqual({ ok: true, code: 0, stage: 'verify', message: 'OK', urn: sealed.seal.urn });
  });

  it('tamper: body content → URN_MISMATCH', () => {
    const sealed = buildSealed({ a: 1, b: 2 }, ctx.keyId, ctx.privPem);
    const tampered: SealV1 = { ...sealed, body: { a: 1, b: 999 } } as const;
    const res = verifySealV1(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('URN_MISMATCH');
  });

  it('tamper: URN string → URN_MISMATCH', () => {
    const sealed = buildSealed({ x: 'y' }, ctx.keyId, ctx.privPem);
    // keep URN syntactically valid, but change the digest (first hex of the 64-long tail)
    const badUrn = sealed.seal.urn.replace(/([0-9a-f]{64})$/, (h) =>
      (h[0] === 'a' ? 'b' : 'a') + h.slice(1)
    );
    const tampered: SealV1 = { ...sealed, seal: { ...sealed.seal, urn: badUrn } } as const;
    const res = verifySealV1(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('URN_MISMATCH');
  });

  it('tamper: signature invalid → SIGNATURE_INVALID', () => {
    const sealed = buildSealed({ p: { q: 1 } }, ctx.keyId, ctx.privPem);

    // Make a valid base64, but invalid signature by flipping a bit in the decoded bytes
    const buf = Buffer.from(sealed.seal.signature, 'base64');
    buf[0] = buf[0] ^ 0x01; // flip lowest bit
    const badSig = Buffer.from(buf).toString('base64');

    const tampered: SealV1 = { ...sealed, seal: { ...sealed.seal, signature: badSig } } as const;
    const res = verifySealV1(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('SIGNATURE_INVALID');
  });

  it('schema: missing signature → SIGNATURE_BASE64_ERROR', () => {
    const sealed = buildSealed({ z: 0 }, ctx.keyId, ctx.privPem);
    // create a runtime copy and delete the field to simulate missing property
    const tampered = JSON.parse(JSON.stringify(sealed)) as SealV1;
    delete (tampered.seal as unknown as { signature?: string }).signature;
    const res = verifySealV1(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('SIGNATURE_BASE64_ERROR');
  });

  it('schema: base64 error → SIGNATURE_BASE64_ERROR', () => {
    const sealed = buildSealed({ n: 1 }, ctx.keyId, ctx.privPem);
    const tampered: SealV1 = { ...sealed, seal: { ...sealed.seal, signature: '%%%not-base64%%%' } } as const;
    const res = verifySealV1(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('SIGNATURE_BASE64_ERROR');
  });

  it('io: missing public key → PUBLIC_KEY_NOT_FOUND', () => {
    const sealed = buildSealed({ k: 'v' }, ctx.keyId, ctx.privPem);
    const bogusDir = path.join(tmpdir(), 'zkpip-missing-key'); // not created on purpose
    const res = verifySealV1(sealed, { keyDir: bogusDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('PUBLIC_KEY_NOT_FOUND');
  });

  afterAll(() => {
    try { rmSync(ctx.keyDir, { recursive: true, force: true }); } catch { /* noop */ }
  });
});
