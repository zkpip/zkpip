// packages/cli/src/commands/vectors/verify-seal.ts
// ZKPIP CLI – `vectors verify-seal` (POC, legacy-kompat)
// - ESM, strict TS, no `any`

import { createHash, verify as nodeVerify } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';

// Keystore util (helyes relatív út a vectors/ alól két szinttel fel)
import { defaultStoreRoot } from '../utils/keystore.js';

// ---------- Local JSON types ----------
type SVPrimitive = string | number | boolean | null;
interface SVObject { readonly [k: string]: SVValue }
type SVArray = ReadonlyArray<SVValue>;
type SVValue = SVPrimitive | SVObject | SVArray;

// ---------- Options & result ----------
export type Options = Readonly<{ keyDir?: string }>;
export type VerifyStage = 'schema' | 'keystore' | 'verify' | 'io';

export type VerifySealResult =
  | Readonly<{ ok: true; code: 0; stage: VerifyStage; message: string; urn: string; }>
  | Readonly<{ ok: false; code: number; stage: VerifyStage; error: string; message: string }>;

function fail(stage: VerifyStage, code: number, error: string, message: string): VerifySealResult {
  return { ok: false as const, code, stage, error, message };
}

// ---------- POC input types (legacy-kompat) ----------
export type SealPOC = Readonly<{
  algo?: 'ed25519';
  algorithm?: 'ed25519';
  id?: string;
  keyId?: string;
  signature?: string;
  sig?: string;
  vectorUrn?: string;
  urn?: string;
  signer?: string;
  envelopeId?: string;
  createdAt?: string;
}>;

export type SealedVectorPOC = Readonly<{
  vector: SVObject;
  seal: SealPOC;
}>;

// ---------- Canonical JSON (egyezik a seal-lel) ----------
function canonicalize(value: unknown): string {
  return _c14n(value);
}
function _c14n(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((it) => _c14n(it)).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${_c14n(obj[k])}`).join(',');
  return `{${body}}`;
}

// ---------- Field readers ----------
function readAlg(seal: SealPOC): 'ed25519' | null {
  const a = seal.algo ?? seal.algo ?? seal.algorithm ?? null;
  return a === 'ed25519' ? 'ed25519' : null;
}

// Prefer explicit logical ids: keyId → kid → id
function readKid(seal: SealPOC): string | null {
  if (typeof seal.keyId === 'string' && seal.keyId.length > 0) return seal.keyId;
  return null;
}

function readSignature(seal: SealPOC): string | null {
  if (typeof seal.signature === 'string' && seal.signature.length > 0) return seal.signature;
  if (typeof seal.sig === 'string' && seal.sig.length > 0) return seal.sig;
  return null;
}

function readUrn(seal: SealPOC): string | null {
  const u = seal.vectorUrn ?? seal.urn ?? null;
  return typeof u === 'string' && u.length > 0 ? u : null;
}

/** Load a public key PEM resolving both legacy and modern layouts.
 * - If keyDir points to a key folder: use "<keyDir>/public.pem"
 * - Else try legacy "<keyDir>/<keyId>.pub.pem"
 * - Else treat keyDir/default as store root: try common patterns, then scan+meta match
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

// ---------- Verify ----------
export function verifySealedVectorPOC(input: SealedVectorPOC, opts: Options = {}): VerifySealResult {
  // 1) Algo
  const alg = readAlg(input.seal);
  if (alg !== 'ed25519') {
    return fail('schema', 3, 'UNSUPPORTED_ALGO', 'Only ed25519 is supported in this POC');
  }

  // 2) Required: keyId + signature
  const kid = readKid(input.seal);
  if (!kid) return fail('schema', 3, 'MISSING_KEYID', 'Missing keyId in seal');

  const sigB64 = readSignature(input.seal);
  if (!sigB64) return fail('schema', 3, 'MISSING_SIGNATURE', 'Missing signature/sig in seal');

  // 3) Base64 validation (schema → code=3)
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sigB64, 'base64');
    if (sigBuf.length === 0 || sigBuf.toString('base64') !== sigB64.replace(/\s+/g, '')) {
      return fail('schema', 3, 'SIGNATURE_BASE64_ERROR', 'Invalid base64 in signature');
    }
  } catch {
    return fail('schema', 3, 'SIGNATURE_BASE64_ERROR', 'Invalid base64 in signature');
  }

  const canon = canonicalize(input.vector);
  const idHex = createHash('sha256').update(canon, 'utf8').digest('hex');

  if (typeof input.seal.id === 'string' && input.seal.id.length > 0 && input.seal.id !== idHex) {
    return fail('verify', 1, 'ID_MISMATCH', 'id does not match sha256(canonical(vector))');
  }

  const providedUrn = readUrn(input.seal);
  if (providedUrn) {
    const expected = `urn:zkpip:vector:sha256:${idHex}`;
    if (providedUrn !== expected) {
      return fail('verify', 4, 'URN_MISMATCH', 'vectorUrn/urn does not match canonical hash');
    }
  }

  let publicPem: string;
  try {
    publicPem = loadPublicKeyPem(opts.keyDir, kid); 
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail('io', 2, 'PUBLIC_KEY_NOT_FOUND', msg);
  }

  // 6) Signature verify
  const okVerify = nodeVerify(null, Buffer.from(canon, 'utf8'), publicPem, sigBuf);
  if (!okVerify) return fail('verify', 4, 'SIGNATURE_INVALID', 'Ed25519 signature verification failed');

  const expected = `urn:zkpip:vector:sha256:${idHex}`;

  return { ok: true, code: 0, stage: 'verify', message: 'OK', urn: expected };
}

export default verifySealedVectorPOC;
