// ZKPIP Core – verifySealV1 (Seal v1)
// ESM, strict TS, no `any`
// Mirrors the previous CLI behavior (codes/stages/messages) so tests remain green.

import { verify as nodeVerify } from 'node:crypto';
import type { ErrorObject } from 'ajv';

// Adjust these relative imports to your actual file layout inside core.
// They intentionally use `.js` for NodeNext ESM.
import { prepareBodyDigest, SealV1 } from '../seal/v1.js';
import { validateSealV1Ajv } from '../schema/validateSeal.js';
import { isOnlyTolerableSealErrors, mapAjvSealErrors } from '../verify/ajvMap.js';
import type { VerifySealOptions } from './types.js';

// ---------- Types (kept compatible with the CLI side) ----------
export type VerifyStage = 'schema' | 'keystore' | 'verify' | 'io';

export type VerifySealResult =
  | Readonly<{ ok: true; code: 0; stage: VerifyStage; message: string; urn: string }>
  | Readonly<{ ok: false; code: number; stage: VerifyStage; error: string; message: string }>;

export type Options = Readonly<{ keyDir?: string | undefined }>;

function fail(stage: VerifyStage, code: number, error: string, message: string): VerifySealResult {
  return { ok: false as const, code, stage, error, message };
}

/**
 * Verify a v1 Seal inside `input`.
 * Error codes kept for backward compatibility:
 *   0 = OK
 *   2 = PUBLIC_KEY_NOT_FOUND
 *   3 = schema errors (SCHEMA_INVALID / SIGNATURE_BASE64_ERROR)
 *   4 = URN_MISMATCH / SIGNATURE_INVALID
 */
export function verifySealV1(input: unknown, opts: VerifySealOptions = {}): VerifySealResult {
  // 1) Fast structural check
  const chk = validateSealV1Ajv(input);
  if (!chk.ok) {
    const minimal = chk.errors ?? [];                 // minimal (path/keyword/message)
    const raw = chk.rawErrors ?? ([] as ErrorObject[]); // raw ErrorObject[]

    if (isOnlyTolerableSealErrors(minimal)) {
      // fall-through
    } else {
      //    algo enum → ALGO_UNSUPPORTED, etc
      const reason = mapAjvSealErrors(raw);
      const message =
        (Array.isArray(minimal) && minimal[0]?.message) || chk.message || String(reason);
      return fail('schema', 3, reason, message);
    }
  }
  // 2) Canon + expected URN over body/kind
  const { body, kind, seal } = input as SealV1;
  const { canon, expectedUrn } = prepareBodyDigest({ body, kind });

  if (seal.urn !== expectedUrn) {
    return fail('verify', 4, 'URN_MISMATCH', 'seal.urn does not match canonical hash of body');
  }

  let publicPem: string | null | undefined;
  try {
    publicPem = opts.getPublicKey?.(seal.keyId);
    if (!publicPem) {
      return fail('io', 2, 'PUBLIC_KEY_NOT_FOUND', `PUBLIC_KEY_NOT_FOUND for keyId="${seal.keyId}"`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail('io', 2, 'PUBLIC_KEY_NOT_FOUND', msg);
  }

  // Signature base64 sanity
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(seal.signature, 'base64');
    if (sigBuf.length === 0 || sigBuf.toString('base64') !== seal.signature.replace(/\s+/g, '')) {
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
