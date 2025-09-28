// ZKPIP CLI – `vectors verify-seal` (Seal v1)
// ESM, strict TS, no `any`
// Uses centralized helpers from @zkpip/core:
//  - prepareBodyDigest(body, kind) → canon + expected URN
//  - validateSealV1 → fast structural checks

import * as fs from 'node:fs';
import path from 'node:path';
import { verify as nodeVerify, createPublicKey } from 'node:crypto';
import { keyIdFromSpki } from '@zkpip/core/keys/keyId';

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

/** Resolve public key PEM by keyId with reverse lookup and fallbacks (sync).
 * Search order (all under base = keyDir || defaultStoreRoot()):
 *  1) keys.index.json → entry.dir/public.pem
 *  2) Structured dirs: <base>/<keyId>/public.pem , <base>/ed25519/<keyId>/public.pem
 *  3) Legacy files:    <base>/<keyId>.pub.pem , <base>/ed25519/<keyId>.pub.pem
 *  4) Legacy singleton: <base>/public.pem , <base>/signer.pub  (only if matches keyId)
 *  5) Scan subdirs:     <base>/public.pem and match computed keyId(SPKI)
 */
function loadPublicKeyPem(keyDir: string | undefined, keyId: string): string {
  const base = keyDir ? path.resolve(keyDir) : defaultStoreRoot();

  const isPlausibleKeyId = (kid: string): boolean =>
    /^[a-z2-7]{20}$/.test(kid); // base32lower, 20ch

  const matchesKid = (pem: string): boolean => {
    try {
      const der = createPublicKey(pem).export({ type: 'spki', format: 'der' }) as Buffer;
      const kid = keyIdFromSpki(new Uint8Array(der));
      return kid === keyId;
    } catch {
      return false;
    }
  };

  // 1) keys.index.json …
  const indexPath = path.join(base, 'keys.index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as unknown;
      if (idx && typeof idx === 'object' && !Array.isArray(idx)) {
        const entry = (idx as Record<string, unknown>)[keyId];
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const dir = (entry as { dir?: unknown }).dir;
          if (typeof dir === 'string') {
            const p = path.join(base, dir, 'public.pem');
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
          }
        }
      }
    } catch { /* ignore malformed index */ }
  }

  // 2) Structured dirs
  for (const p of [
    path.join(base, keyId, 'public.pem'),
    path.join(base, 'ed25519', keyId, 'public.pem'),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }

  // 3) Legacy files named by keyId
  for (const p of [
    path.join(base, `${keyId}.pub.pem`),
    path.join(base, 'ed25519', `${keyId}.pub.pem`),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }

  // 4) Legacy singleton at root
  //    - if keyId looks like a real kid -> require match
  //    - else (labelish keyId) accept as last resort for backwards compat
  for (const p of [path.join(base, 'public.pem'), path.join(base, 'signer.pub')]) {
    if (!fs.existsSync(p)) continue;
    const pem = fs.readFileSync(p, 'utf8');
    if (isPlausibleKeyId(keyId)) {
      if (matchesKid(pem)) return pem;      // strict when kid is plausible
    } else {
      return pem;                            // permissive when keyId is a label (legacy tests)
    }
  }

  // 5) Scan subdirs for public.pem and match computed keyId
  if (fs.existsSync(base)) {
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const pub = path.join(base, e.name, 'public.pem');
      if (!fs.existsSync(pub)) continue;
      const pem = fs.readFileSync(pub, 'utf8');
      if (!isPlausibleKeyId(keyId) || matchesKid(pem)) {
        return pem;
      }
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
