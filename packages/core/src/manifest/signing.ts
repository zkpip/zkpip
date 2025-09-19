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

export function verifyManifest({ manifest, publicKeyPem }: VerifyParams): { ok: boolean; reason?: string } {
  if (!manifest.signature) return { ok: false, reason: 'missing_signature' };
  if (!manifest.hash) return { ok: false, reason: 'missing_hash' };
  const { signature, hash } = manifest;
  if (signature.alg !== 'Ed25519') return { ok: false, reason: `unsupported_alg:${signature.alg}` };

  // Recompute hash and compare
  const recomputed = computeManifestHash(manifest);
  if (recomputed.value !== hash.value) {
    return { ok: false, reason: 'hash_mismatch' };
  }

  const pub = fromPemPublic(publicKeyPem);
  const sigBuf = Buffer.from(signature.sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const msgBuf = Buffer.from(hash.value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  const ok = nodeVerify(null, msgBuf, pub, sigBuf);
  return ok ? { ok } : { ok: false, reason: 'signature_invalid' };
}
