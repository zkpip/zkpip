// packages/cli/src/__tests__/vectors.verify-seal.poc.test.ts
// Seal v1 unit tests for `vectors verify-seal`
// - English comments, strict TS, no `any`
// - Uses core C14N + sha256; asserts URN + Ed25519 flow

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';

import verifySealV1, {
  type VerifySealResult,
} from '../commands/verifySeal.js';

import { canonicalize, sha256Hex, type JsonValue } from '@zkpip/core/json/c14n';
import type { SealV1 } from '@zkpip/core/seal/v1';

// ---- Helpers ----

function toUrnFromHex(hex: string, kind = 'vector'): string {
  return `urn:zkpip:${kind}:sha256:${hex}`;
}

function createTempKeyDir(): string {
  return mkdtempSync(join(tmpdir(), 'zkpip-keys-'));
}

function writePublicKeyPem(dir: string, pem: string): void {
  // The verifier searches several patterns; the simplest is <keyDir>/public.pem
  writeFileSync(join(dir, 'public.pem'), pem, { encoding: 'utf8' });
}

function makeBody(): JsonValue {
  // Deliberately shuffled keys and nested objects to validate canonicalization
  return {
    zeta: 3,
    alpha: 'x',
    nested: {
      b: [3, 2, 1],
      a: { y: null, x: true },
    },
    list: [{ k: 'v' }, { k: 'w' }],
  } as const;
}

function signCanonEd25519(canon: string, privPem: string): string {
  const privKey = createPrivateKey(privPem);
  const sigBuf = edSign(null, Buffer.from(canon, 'utf8'), privKey);
  return sigBuf.toString('base64');
}

// ---- Tests ----

describe('vectors verify-seal (Seal v1)', () => {
  it('verifies a valid sealed body (happy path)', () => {
    // Generate ephemeral Ed25519 keypair
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test1';
    writePublicKeyPem(keyDir, pubPem);

    const body = makeBody();
    const canon = canonicalize(body);
    const hex = sha256Hex(canon);
    const urn = toUrnFromHex(hex);

    const sealed: SealV1 = {
      version: '1',
      kind: 'vector',
      body,
      seal: {
        algo: 'ed25519',
        keyId,
        signature: signCanonEd25519(canon, privPem),
        urn,
      },
    } as const;

    const res: VerifySealResult = verifySealV1(sealed, { keyDir });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.code).toBe(0);
      expect(res.urn).toBe(urn);
    }

    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fails when URN does not match sha256(canonical(body))', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test2';
    writePublicKeyPem(keyDir, pubPem);

    const body = makeBody();
    const canon = canonicalize(body);
    const hex = sha256Hex(canon);
    const urn = toUrnFromHex(hex);

    const sealed: SealV1 = {
      version: '1',
      kind: 'vector',
      body,
      seal: {
        algo: 'ed25519',
        keyId,
        signature: signCanonEd25519(canon, privPem),
        urn: urn.replace(/([0-9a-f]{64})$/, h => (h[0] === 'a' ? 'b' : 'a') + h.slice(1)), 
      },
    } as const;

    const res = verifySealV1(sealed, { keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(4); // verify_error
      expect(res.error).toBe('URN_MISMATCH');
    }

    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fails on invalid base64 signature', () => {
    const { publicKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test3';
    writePublicKeyPem(keyDir, pubPem);

    const body = makeBody();
    const canon = canonicalize(body);
    const hex = sha256Hex(canon);

    const sealed: SealV1 = {
      version: '1',
      kind: 'vector',
      body,
      seal: {
        algo: 'ed25519',
        keyId,
        signature: '***not-base64***',
        urn: toUrnFromHex(hex),
      },
    } as const;

    const res = verifySealV1(sealed, { keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(3); // schema_invalid
      expect(res.error).toBe('SIGNATURE_BASE64_ERROR');
    }

    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fails when public key cannot be found', () => {
    const emptyDir = createTempKeyDir(); // no key files
    const { privateKey } = generateKeyPairSync('ed25519');
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const body = makeBody();
    const canon = canonicalize(body);
    const hex = sha256Hex(canon);

    const sealed: SealV1 = {
      version: '1',
      kind: 'vector',
      body,
      seal: {
        algo: 'ed25519',
        keyId: 'missing',
        signature: signCanonEd25519(canon, privPem),
        urn: toUrnFromHex(hex),
      },
    } as const;

    const res = verifySealV1(sealed, { keyDir: emptyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(2); // io_error
      expect(res.error).toBe('PUBLIC_KEY_NOT_FOUND');
    }

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it('fails on unsupported algo', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test4';
    writePublicKeyPem(keyDir, pubPem);

    const body = makeBody();
    const canon = canonicalize(body);
    const hex = sha256Hex(canon);

    const sealed = {
      version: '1',
      kind: 'vector',
      body,
      seal: {
        algo: 'rsa2048', // unsupported
        keyId,
        signature: signCanonEd25519(canon, privPem),
        urn: toUrnFromHex(hex),
      },
    } as unknown as SealV1;

    const res = verifySealV1(sealed, { keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(3); // schema_invalid
      expect(res.error).toBe('ALGO_UNSUPPORTED');
    }

    rmSync(keyDir, { recursive: true, force: true });
  });
});
