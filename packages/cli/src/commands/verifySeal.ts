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
  | Readonly<{ ok: true; code: 0; stage: VerifyStage; message: string }>
  | Readonly<{ ok: false; code: number; stage: VerifyStage; error: string; message: string }>;

function ok(stage: VerifyStage, message = 'OK'): VerifySealResult {
  return { ok: true as const, code: 0 as const, stage, message };
}
function fail(stage: VerifyStage, code: number, error: string, message: string): VerifySealResult {
  return { ok: false as const, code, stage, error, message };
}

// ---------- POC input types (legacy-kompat) ----------
export type SealPOC = Readonly<{
  // accept modern + legacy names
  alg?: 'ed25519';        // modern
  algo?: 'ed25519';       // legacy
  algorithm?: 'ed25519';  // legacy alt

  kid?: string;           // modern
  keyId?: string;         // legacy/newer alt
  id?: string;            // some older payloads used this for key id

  signature?: string;     // modern
  sig?: string;           // legacy

  vectorUrn: string;
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
  const a = seal.alg ?? seal.algo ?? seal.algorithm ?? null;
  return a === 'ed25519' ? 'ed25519' : null;
}

// Prefer explicit logical ids: keyId → kid → id
function readKid(seal: SealPOC): string | null {
  if (typeof seal.keyId === 'string' && seal.keyId.length > 0) return seal.keyId;
  if (typeof seal.kid === 'string' && seal.kid.length > 0) return seal.kid;
  if (typeof seal.id === 'string' && seal.id.length > 0) return seal.id;
  return null;
}

function readSignature(seal: SealPOC): string | null {
  if (typeof seal.signature === 'string' && seal.signature.length > 0) return seal.signature;
  if (typeof seal.sig === 'string' && seal.sig.length > 0) return seal.sig;
  return null;
}

// ---------- Public key loading (legacy + modern layout) ----------
function defaultKeyDir(): string {
  // modern default: ~/.zkpip/keys (a defaultStoreRoot ezt adja)
  return defaultStoreRoot();
}

/** Load a public key PEM resolving both legacy and modern layouts.
 * - If keyDir points to a key folder: use "<keyDir>/public.pem"
 * - Else try legacy "<keyDir>/<keyId>.pub.pem"
 * - Else treat keyDir/default as store root: try common patterns, then scan+meta match
 */
function loadPublicKeyPem(maybeDir: string | undefined, keyId: string): string {
  const base = maybeDir ? path.resolve(maybeDir) : defaultKeyDir();

  // 1) Direct candidates (key dir or legacy flat pub file)
  for (const p of [path.join(base, 'public.pem'), path.join(base, `${keyId}.pub.pem`)]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }

  // 2) Common store-root patterns
  for (const p of [
    path.join(base, 'ed25519', keyId, 'public.pem'),
    path.join(base, keyId, 'public.pem'),
    path.join(base, 'ed25519', `${keyId}.pub.pem`),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }

  // 3) Scan subdirs and match meta (kid/keyId/label)
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base, { withFileTypes: true }).filter((ent) => ent.isDirectory());
    for (const ent of dirs) {
      const dir = path.join(base, ent.name);
      const pub = path.join(dir, 'public.pem');
      if (!fs.existsSync(pub)) continue;

      const metaPath = ['key.meta.json', 'meta.json', 'key.json']
        .map((f) => path.join(dir, f))
        .find((p) => fs.existsSync(p));

      if (metaPath) {
        try {
          const m = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as unknown;
          if (m && typeof m === 'object' && !Array.isArray(m)) {
            const mkid =
              (m as { keyId?: unknown }).keyId && typeof (m as { keyId?: unknown }).keyId === 'string'
                ? (m as { keyId: string }).keyId
                : (m as { kid?: unknown }).kid && typeof (m as { kid?: unknown }).kid === 'string'
                  ? (m as { kid: string }).kid
                  : (m as { label?: unknown }).label && typeof (m as { label?: unknown }).label === 'string'
                    ? (m as { label: string }).label
                    : null;

            if (mkid === keyId) return fs.readFileSync(pub, 'utf8');
          }
        } catch { /* ignore and continue */ }
      }
    }
  }

  throw new Error(`PUBLIC_KEY_NOT_FOUND for keyId="${keyId}" under "${base}"`);
}

// ---------- Verify ----------
export function verifySealedVectorPOC(input: SealedVectorPOC, opts: Options = {}): VerifySealResult {
  // 1) Schema checks
  if (readAlg(input.seal) !== 'ed25519') {
    return fail('schema', 3, 'UNSUPPORTED_ALGO', 'Only ed25519 is supported in this POC');
  }
  const kid = readKid(input.seal);
  if (!kid) return fail('schema', 3, 'MISSING_KEYID', 'Missing keyId/id in seal');

  const sigB64 = readSignature(input.seal);
  if (!sigB64) return fail('schema', 3, 'MISSING_SIGNATURE', 'Missing signature/sig in seal');

  if (typeof input.seal.vectorUrn !== 'string' || input.seal.vectorUrn.length === 0) {
    return fail('schema', 3, 'MISSING_VECTOR_URN', 'Missing vectorUrn in seal');
  }

  // 2) Canonicalize + hash → URN match
  const canon = canonicalize(input.vector);
  const digest = createHash('sha256').update(canon, 'utf8').digest('hex');
  const expectedUrn = `urn:zkpip:vector:sha256:${digest}`;
  if (expectedUrn !== input.seal.vectorUrn) {
    return fail('verify', 4, 'URN_MISMATCH', 'vectorUrn does not match canonical hash');
  }

  // 3) Public key
  let publicPem: string;
  try {
    publicPem = loadPublicKeyPem(opts.keyDir, kid);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail('keystore', 2, 'PUBLIC_KEY_NOT_FOUND', msg);
  }

  // 4) Signature verify (Ed25519)
  const okSig = nodeVerify(null, Buffer.from(canon, 'utf8'), publicPem, Buffer.from(sigB64, 'base64'));
  if (!okSig) return fail('verify', 4, 'SIGNATURE_INVALID', 'Ed25519 signature verification failed');

  return ok('verify');
}

export default verifySealedVectorPOC;
