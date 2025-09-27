// ZKPIP Seal v1 — types + minimal runtime validator
// English comments, strict TS, no `any`
// Purpose: generic, future-proof seal container using `body` (not `vector`).
// - Hashing/URN/signature always computed over C14N(body)
// - Optional `kind` discriminator (e.g. "vector", "circuit", "image")

import { canonicalize, sha256Hex, toVectorUrn, type JsonValue } from '../json/c14n.js';

export type SealAlgoV1 = 'ed25519';

export interface SealBlockV1 {
  readonly algo: SealAlgoV1;                 // signing algorithm
  readonly keyId: string;                    // logical key identifier
  readonly signature: string;                // base64-encoded signature over canonicalized `body`
  readonly urn: string;                      // e.g., urn:zkpip:vector:sha256:<64-hex>
  readonly signer?: string | undefined;      // optional signer/tool tag
  readonly createdAt?: string | undefined;   // ISO 8601 timestamp
}

export interface SealV1 {
  readonly version?: '1' | undefined;        // may be omitted, treated as "1"
  readonly kind?: string | undefined;        // discriminator, e.g., "vector", "circuit"
  readonly body: JsonValue;                  // hashed/signature subject
  readonly seal: SealBlockV1;                // signature metadata
}

export interface SealV1Ok {
  readonly ok: true;
  readonly value: Readonly<SealV1>;
}

export interface SealV1Err {
  readonly ok: false;
  readonly error: string;                    // symbolic code
  readonly message: string;                  // human readable
}

export type SealV1Check = SealV1Ok | SealV1Err;

// --- helpers ---
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const URN_RE = /^urn:zkpip:[a-z0-9-]+:sha256:[0-9a-f]{64}$/;

function isIsoDateTime(s: string): boolean {
  // Accepts basic ISO 8601 `YYYY-MM-DDTHH:mm:ss.sssZ` or with timezone offset
  // Rely on Date parse as a coarse check, plus `!isNaN(date.getTime())`
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

/** Minimal, fast structural validation. For full JSON Schema validation, use the schema file. */
export function validateSealV1(input: unknown): SealV1Check {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'TYPE', message: 'Seal must be an object' };
  }
  const obj = input as Partial<SealV1>;

  // body present
  if (!('body' in obj)) {
    return { ok: false, error: 'BODY_MISSING', message: 'Missing `body`' };
  }

  // seal present
  if (!('seal' in obj) || typeof obj.seal !== 'object' || obj.seal === null) {
    return { ok: false, error: 'SEAL_MISSING', message: 'Missing `seal` block' };
  }

  const { algo, keyId, signature, urn, signer, createdAt } = obj.seal as SealBlockV1;

  // Required fields
  if (algo !== 'ed25519') {
    return { ok: false, error: 'ALGO_UNSUPPORTED', message: 'Only ed25519 is supported in v1' };
  }
  if (typeof keyId !== 'string' || keyId.length === 0) {
    return { ok: false, error: 'KEYID_INVALID', message: 'keyId must be a non-empty string' };
  }
  if (typeof signature !== 'string' || !B64_RE.test(signature)) {
    return { ok: false, error: 'SIGNATURE_BASE64_ERROR', message: 'signature must be base64' };
  }
  if (typeof urn !== 'string' || !URN_RE.test(urn)) {
    return { ok: false, error: 'URN_INVALID', message: 'urn must match urn:zkpip:<kind>:sha256:<hex64>' };
  }

  // Optional fields
  if (typeof signer !== 'undefined' && typeof signer !== 'string') {
    return { ok: false, error: 'SIGNER_INVALID', message: 'signer must be string if provided' };
  }
  if (typeof createdAt !== 'undefined' && (typeof createdAt !== 'string' || !isIsoDateTime(createdAt))) {
    return { ok: false, error: 'CREATED_AT_INVALID', message: 'createdAt must be ISO date-time if provided' };
  }

  return { ok: true, value: obj as SealV1 };
}

/**
 * Deterministically recompute sha256/URN over C14N(body).
 * Returns `{ canon, sha256Hex, expectedUrn }` for verification and signing.
 */
export function prepareBodyDigest(input: Pick<SealV1, 'body' | 'kind'>): {
  readonly canon: string;
  readonly digestHex: string;
  readonly expectedUrn: string;
} {
  const canon = canonicalize(input.body);
  const digestHex = sha256Hex(canon);
  // Compose URN with provided kind (defaults to 'vector' if missing)
  const subject = (input.kind && /^[a-z][a-z0-9-]{1,63}$/.test(input.kind)) ? input.kind : 'vector';
  const expectedUrn = toVectorUrn(digestHex).replace('urn:zkpip:vector:', `urn:zkpip:${subject}:`);
  return { canon, digestHex, expectedUrn };
}
