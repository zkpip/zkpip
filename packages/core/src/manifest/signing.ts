// Ed25519 sign/verify over the SHA-256 digest of the canonicalized payload (without signature).
// Private/public keys are expected in PEM (PKCS#8 for private, SPKI for public).

import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify, KeyObject } from 'node:crypto';
import { computeManifestHash } from './hashing.js';
import type { ZkpipManifest, ManifestSignature, SigAlg } from './types.js';

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromPemPrivate(pem: string): KeyObject {
  return createPrivateKey({ key: pem });
}
function fromPemPublic(pem: string): KeyObject {
  return createPublicKey({ key: pem });
}

export interface SignParams {
  manifest: ZkpipManifest;
  privateKeyPem: string;
  keyId: string;
  alg?: SigAlg; // default: Ed25519
}

export function signManifest({ manifest, privateKeyPem, keyId, alg = 'Ed25519' }: SignParams) {
  if (alg !== 'Ed25519') {
    throw new Error(`Unsupported signature algorithm in M1/A: ${alg}`);
  }
  const hash = computeManifestHash(manifest); // excludes signature
  const priv = fromPemPrivate(privateKeyPem);

  // Node's Ed25519 uses null digest algorithm with raw message; here we sign the digest bytes explicitly.
  // To keep behavior explicit, we sign the digest buffer as the "message".
  const sigBuf = nodeSign(null, Buffer.from(hash.value.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), priv);
  const signature: ManifestSignature = { alg, keyId, sig: toBase64Url(sigBuf) };
  return { hash, signature };
}

export interface VerifyParams {
  manifest: ZkpipManifest;
  publicKeyPem: string;
}

function* collectSignatures(m: ZkpipManifest): Generator<ManifestSignature> {
  if (m.signature) yield m.signature;
  if (Array.isArray(m.signatures)) {
    for (const s of m.signatures) if (s) yield s;
  }
}

function b64UrlToStd(s: string): string {
  // allow URL-safe base64 too
  return s.replace(/-/g, '+').replace(/_/g, '/');
}

export interface VerifyParams {
  manifest: ZkpipManifest;
  publicKeyPem: string;
}

export function verifyManifest({ manifest, publicKeyPem }: VerifyParams): { ok: boolean; reason?: string } {
  if (!manifest.hash) return { ok: false, reason: 'missing_hash' };

  const recomputed = computeManifestHash(manifest);
  if (recomputed.value !== manifest.hash.value) {
    return { ok: false, reason: 'hash_mismatch' };
  }

  let tried = 0;
  for (const signature of collectSignatures(manifest)) {
    tried++;
    if (signature.alg !== 'Ed25519') continue;

    const pub = fromPemPublic(publicKeyPem);
    const sigBuf = Buffer.from(b64UrlToStd(signature.sig), 'base64');
    const msgBuf = Buffer.from(b64UrlToStd(manifest.hash.value), 'base64');

    const ok = nodeVerify(null, msgBuf, pub, sigBuf);
    if (ok) return { ok: true };
  }
  if (tried === 0) return { ok: false, reason: 'missing_signature' };
  return { ok: false, reason: 'signature_invalid' };
}
