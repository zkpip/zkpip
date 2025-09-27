// Vitest tamper tests for `verifySealedVectorPOC`
// - English comments, strict TS, no `any`
// - Generates an ephemeral Ed25519 keypair, writes public.pem into a temp keystore dir
// - Builds a valid sealed vector, then tampers various fields and asserts specific errors

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { generateKeyPairSync, sign as nodeSign } from 'node:crypto';

import { canonicalize, sha256Hex, toVectorUrn } from '@zkpip/core/json/c14n';
import verifySealedVectorPOC, { type SealedVectorPOC, type Options, type SVObject } from '../commands/verifySeal.js';

// ---------- helpers ----------
function createKeystore(): { keyDir: string; keyId: string; privPem: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'zkpip-key-'));
  const keyId = path.basename(dir);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  writeFileSync(path.join(dir, 'public.pem'), pubPem, 'utf8');
  return { keyDir: dir, keyId, privPem };
}

function signCanonEd25519(canon: string, privPem: string): string {
  const sig = nodeSign(null, Buffer.from(canon, 'utf8'), privPem);
  return sig.toString('base64');
}

function buildSealed(vector: SVObject, keyId: string, privPem: string): SealedVectorPOC {
  const canon = canonicalize(vector);
  const idHex = sha256Hex(canon);
  const urn = toVectorUrn(idHex);
  const signature = signCanonEd25519(canon, privPem);
  return {
    vector,
    seal: {
      signer: 'codeseal/0',
      algo: 'ed25519',
      id: idHex,
      urn,
      keyId,
      signature,
    },
  } as const;
}

// ---------- test suite ----------
describe('vectors verify-seal — tamper scenarios', () => {
  const ctx: { keyDir: string; keyId: string; privPem: string } = { keyDir: '', keyId: '', privPem: '' };

  beforeAll(() => {
    const ks = createKeystore();
    ctx.keyDir = ks.keyDir;
    ctx.keyId = ks.keyId;
    ctx.privPem = ks.privPem;
  });

  it('baseline: valid sealed vector verifies OK', () => {
    const vector: SVObject = { a: 1, b: 2 };
    const sealed = buildSealed(vector, ctx.keyId, ctx.privPem);
    const res = verifySealedVectorPOC(sealed, { keyDir: ctx.keyDir } satisfies Options);
    expect(res).toEqual({ ok: true, code: 0, stage: 'verify', message: 'OK', urn: sealed.seal.urn! });
  });

  it('tamper: vector content → ID_MISMATCH', () => {
    const sealed = buildSealed({ a: 1, b: 2 }, ctx.keyId, ctx.privPem);
    const tampered: SealedVectorPOC = { ...sealed, vector: { a: 1, b: 999 } } as const;
    const res = verifySealedVectorPOC(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('ID_MISMATCH');
  });

  it('tamper: URN string → URN_MISMATCH', () => {
    const sealed = buildSealed({ x: 'y' }, ctx.keyId, ctx.privPem);
    const tampered: SealedVectorPOC = { ...sealed, seal: { ...sealed.seal, urn: sealed.seal.urn! + 'x' } } as const;
    const res = verifySealedVectorPOC(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('URN_MISMATCH');
  });

  it('tamper: signature invalid → SIGNATURE_INVALID', () => {
    const sealed = buildSealed({ p: { q: 1 } }, ctx.keyId, ctx.privPem);

    // Make a valid base64, but invalid signature by flipping a bit in the decoded bytes
    const buf = Buffer.from(sealed.seal.signature!, 'base64');
    buf[0] = buf[0] ^ 0x01; // flip lowest bit
    const badSig = Buffer.from(buf).toString('base64');

    const tampered: SealedVectorPOC = { ...sealed, seal: { ...sealed.seal, signature: badSig } } as const;
    const res = verifySealedVectorPOC(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('SIGNATURE_INVALID');
  });

  it('schema: missing signature → MISSING_SIGNATURE', () => {
    const sealed = buildSealed({ z: 0 }, ctx.keyId, ctx.privPem);
    const tampered: SealedVectorPOC = { ...sealed, seal: { ...sealed.seal, signature: undefined, sig: undefined } } as unknown as SealedVectorPOC;
    const res = verifySealedVectorPOC(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('MISSING_SIGNATURE');
  });

  it('schema: base64 error → SIGNATURE_BASE64_ERROR', () => {
    const sealed = buildSealed({ n: 1 }, ctx.keyId, ctx.privPem);
    const tampered: SealedVectorPOC = { ...sealed, seal: { ...sealed.seal, signature: '%%%not-base64%%%' } } as const;
    const res = verifySealedVectorPOC(tampered, { keyDir: ctx.keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('SIGNATURE_BASE64_ERROR');
  });

  it('io: missing public key → PUBLIC_KEY_NOT_FOUND', () => {
    const sealed = buildSealed({ k: 'v' }, ctx.keyId, ctx.privPem);
    const bogusDir = path.join(tmpdir(), 'zkpip-missing-key'); // not created on purpose
    const res = verifySealedVectorPOC(sealed, { keyDir: bogusDir });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('PUBLIC_KEY_NOT_FOUND');
  });

  afterAll(() => {
    try { rmSync(ctx.keyDir, { recursive: true, force: true }); } catch { /* noop */ }
  });
});
