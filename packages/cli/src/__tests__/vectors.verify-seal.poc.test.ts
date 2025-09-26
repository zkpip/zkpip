// packages/cli/src/__tests__/vectors.verify-seal.poc.test.ts
// Vitest unit tests for `vectors verify-seal` POC logic (revised)
// - Imports shared Json types from ../types/json.js
// - English comments, strict TS, no `any`

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';

import verifySealedVectorPOC, {
  type SealedVectorPOC,
  type VerifySealResult,
} from '../commands/verifySeal.js';
import type { Json, JsonObject } from '../types/json.js';

// ---- Canonical deterministic stringify using shared Json types ----
// Sorts object keys lexicographically; arrays preserved; primitives unchanged.
// NOTE: Keep in sync with CLI module logic.
function stableStringifyTest(value: Json): string {
  const seen = new WeakSet<object>();
  function walk(v: Json): unknown {
    if (v === null) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.map(walk);
    const obj = v as JsonObject;
    if (seen.has(obj as object)) throw new Error('CYCLE_NOT_SUPPORTED');
    seen.add(obj as object);
    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) {
      const val = (obj as Record<string, Json>)[k] as Json;
      out[k] = walk(val);
    }
    return out;
  }
  return JSON.stringify(walk(value));
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function toURNFromHex(hex: string): string {
  return `urn:zkpip:vector:sha256:${hex}`;
}

// ---- Helpers to craft a sealed vector using our temp key ----
function createTempKeyDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'zkpip-keys-'));
  return dir;
}

function writePublicKeyPem(dir: string, keyId: string, pem: string): void {
  // File name convention must match CLI: <keyId>.pub.pem
  writeFileSync(join(dir, `${keyId}.pub.pem`), pem, { encoding: 'utf8' });
}

function makeVector(): JsonObject {
  // Deliberately shuffled keys and nested objects to validate canonicalization
  return {
    zeta: 3,
    alpha: 'x',
    nested: {
      b: [3, 2, 1],
      a: { y: null, x: true },
    },
    list: [{ k: 'v' }, { k: 'w' }],
  } as const satisfies JsonObject;
}

function sealVector(vector: JsonObject, privPem: string): { id: string; signature: string; canonical: string } {
  const canonical = stableStringifyTest(vector);
  const id = sha256Hex(canonical);
  // Sign canonical JSON (utf8 bytes) with Ed25519 private key
  const privKey = createPrivateKey(privPem);
  const sigBuf = edSign(null, Buffer.from(canonical, 'utf8'), privKey);
  return { id, signature: sigBuf.toString('base64'), canonical };
}

// ---- Tests ----

describe('vectors verify-seal (POC)', () => {
  it('verifies a valid sealed vector (happy path)', () => {
    // Generate ephemeral Ed25519 keypair
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test1';
    writePublicKeyPem(keyDir, keyId, pubPem);

    const vector = makeVector();
    const { id, signature, canonical } = sealVector(vector, privPem);

    const sealed: SealedVectorPOC = {
      vector,
      seal: { algo: 'ed25519', keyId, id, signature },
    } as const;

    const res: VerifySealResult = verifySealedVectorPOC(sealed, { keyDir });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.code).toBe(0);
      expect(res.urn).toBe(toURNFromHex(sha256Hex(canonical))); // must match
    }

    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fails when id does not match sha256(canonical(vector))', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test2';
    writePublicKeyPem(keyDir, keyId, pubPem);

    const vector = makeVector();
    const { id, signature } = sealVector(vector, privPem);

    const badId = id.replace(/^./, id[0] === 'a' ? 'b' : 'a'); // flip first hex char

    const sealed: SealedVectorPOC = {
      vector,
      seal: { algo: 'ed25519', keyId, id: badId, signature },
    } as const;

    const res = verifySealedVectorPOC(sealed, { keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(1); // verify_error
      expect(res.error).toBe('ID_MISMATCH');
    }

    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fails on invalid base64 signature', () => {
    const { publicKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const keyDir = createTempKeyDir();
    const keyId = 'test3';
    writePublicKeyPem(keyDir, keyId, pubPem);

    const vector = makeVector();
    const canonical = stableStringifyTest(vector);
    const id = sha256Hex(canonical);

    const sealed: SealedVectorPOC = {
      vector,
      seal: { algo: 'ed25519', keyId, id, signature: '***not-base64***' },
    } as const;

    const res = verifySealedVectorPOC(sealed, { keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(3); // schema_invalid
      expect(res.error).toBe('SIGNATURE_BASE64_ERROR');
    }

    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fails when public key cannot be found', () => {
    // Do not write any key files, point to an empty temp dir
    const emptyDir = createTempKeyDir();
    const vector = makeVector();
    const { privateKey } = generateKeyPairSync('ed25519');
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const { id, signature } = sealVector(vector, privPem);

    const sealed: SealedVectorPOC = {
      vector,
      seal: { algo: 'ed25519', keyId: 'missing', id, signature },
    } as const;

    const res = verifySealedVectorPOC(sealed, { keyDir: emptyDir });
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
    writePublicKeyPem(keyDir, keyId, pubPem);

    const vector = makeVector();
    const { id, signature } = sealVector(vector, privPem);

    const sealed = {
      vector,
      seal: { algo: 'rsa2048', keyId, id, signature },
    } as unknown as SealedVectorPOC;

    const res = verifySealedVectorPOC(sealed, { keyDir });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(3); // schema_invalid
      expect(res.error).toBe('UNSUPPORTED_ALGO');
    }

    rmSync(keyDir, { recursive: true, force: true });
  });
});
