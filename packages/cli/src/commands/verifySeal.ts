// ZKPIP CLI – `vectors verify-seal` (Seal v1)
// ESM, strict TS, no `any`
// Uses centralized helpers from @zkpip/core:
//  - prepareBodyDigest(body, kind) → canon + expected URN
//  - validateSealV1 → fast structural checks

import { verify as nodeVerify } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';

// Keystore util
import { defaultStoreRoot } from '../utils/keystore.js';

// Core v1 Seal helpers
import { validateSealV1, prepareBodyDigest, type SealV1 } from '@zkpip/core/seal/v1';

// ---------- Options & result ----------
export type Options = Readonly<{ keyDir?: string | undefined }>;
export type VerifyStage = 'schema' | 'keystore' | 'verify' | 'io';

export type VerifySealResult =
  | Readonly<{ ok: true; code: 0; stage: VerifyStage; message: string; urn: string }>
  | Readonly<{ ok: false; code: number; stage: VerifyStage; error: string; message: string }>;

function fail(stage: VerifyStage, code: number, error: string, message: string): VerifySealResult {
  return { ok: false as const, code, stage, error, message };
}

/** Load a public key PEM resolving common layouts.
 * - If keyDir points to a key folder: use "<keyDir>/public.pem"
 * - Else try legacy "<keyDir>/<keyId>.pub.pem"
 * - Else treat keyDir/default as store root and try common patterns
 */
function loadPublicKeyPem(keyDir: string | undefined, keyId: string): string {
  const base = keyDir ? path.resolve(keyDir) : defaultStoreRoot();

  const candidates: string[] = [
    path.join(base, 'public.pem'),
    path.join(base, `${keyId}.pub.pem`),
    path.join(base, 'ed25519', keyId, 'public.pem'),
    path.join(base, keyId, 'public.pem'),
    path.join(base, 'ed25519', `${keyId}.pub.pem`),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }

  if (fs.existsSync(base)) {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const pub = path.join(base, e.name, 'public.pem');
      if (fs.existsSync(pub)) return fs.readFileSync(pub, 'utf8');
    }
  }

  throw new Error(`PUBLIC_KEY_NOT_FOUND under "${base}" for keyId="${keyId}"`);
}

// ---------- Verify (v1) ----------
export function verifySealV1(input: SealV1, opts: Options = {}): VerifySealResult {
  // 1) Minimal schema/shape (fast)
  const chk = validateSealV1(input);
  if (!chk.ok) return fail('schema', 3, chk.error, chk.message);

  // 2) Canon + expected URN over body/kind
  const { canon, expectedUrn } = prepareBodyDigest({ body: input.body, kind: input.kind });

  // 3) URN must match
  if (input.seal.urn !== expectedUrn) {
    return fail('verify', 4, 'URN_MISMATCH', 'seal.urn does not match canonical hash of body');
  }

  // 4) Load public key PEM
  let publicPem: string;
  try {
    publicPem = loadPublicKeyPem(opts.keyDir, input.seal.keyId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail('io', 2, 'PUBLIC_KEY_NOT_FOUND', msg);
  }

  // 5) Signature: base64 sanity then Ed25519 verify
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(input.seal.signature, 'base64');
    if (sigBuf.length === 0 || sigBuf.toString('base64') !== input.seal.signature.replace(/\s+/g, '')) {
      return fail('schema', 3, 'SIGNATURE_BASE64_ERROR', 'Invalid base64 in signature');
    }
  } catch {
    return fail('schema', 3, 'SIGNATURE_BASE64_ERROR', 'Invalid base64 in signature');
  }

  const okVerify = nodeVerify(null, Buffer.from(canon, 'utf8'), publicPem, sigBuf);
  if (!okVerify) return fail('verify', 4, 'SIGNATURE_INVALID', 'Ed25519 signature verification failed');

  return { ok: true, code: 0, stage: 'verify', message: 'OK', urn: expectedUrn };
}

export default verifySealV1;
