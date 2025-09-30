// English comments, strict TS, no `any`.

import type { ErrorObject } from 'ajv';
import type { VerifyReason } from './codes.js';

export type AjvErr = Readonly<{
  instancePath?: string;
  keyword?: string;
  params?: Record<string, unknown>;
  message?: string;
}>;

export type SealSchemaReason =
  | 'SIGNATURE_BASE64_ERROR'
  | 'ALGO_UNSUPPORTED'
  | 'SCHEMA_INVALID';

export function mapAjvSealErrors(errs: readonly AjvErr[]): SealSchemaReason {
  for (const e of errs) {
    const path = e.instancePath ?? '';
    const kw = e.keyword;

    // Unsupported algorithm → enum fail on /seal/algo
    if (path === '/seal/algo' && kw === 'enum') return 'ALGO_UNSUPPORTED';

    // Missing or invalid signature → required('signature') on /seal,
    // or pattern/type fail on /seal/signature
    const params = e.params as Readonly<Record<string, unknown>>;
    const missing = typeof params?.['missingProperty'] === 'string' ? (params['missingProperty'] as string) : null;

    if ((path === '/seal' && kw === 'required' && missing === 'signature')
    || (path === '/seal/signature')) {
      return 'SIGNATURE_BASE64_ERROR';
    }
  }
  return 'SCHEMA_INVALID';
}

/** Non-critical schema errors we can tolerate and proceed with semantic checks. */
export function isOnlyTolerableSealErrors(errs: readonly AjvErr[]): boolean {
  if (errs.length === 0) return true;
  return errs.every((e) => {
    const p = e.instancePath ?? '';
    const kw = e.keyword;
    // tolerate urn/keyId format/pattern issues
    if (p === '/seal/urn' && (kw === 'pattern' || kw === 'type')) return true;
    if (p === '/seal/keyId' && (kw === 'pattern' || kw === 'type' || kw === 'minLength')) return true;
    // tolerate body/kind "type looseness" (mert úgyis URN ellenőrzés lesz)
    if ((p === '/body' || p === '/kind') && (kw === 'type' || kw === 'enum' || kw === 'pattern')) return true;
    return false;
  });
}

/** Narrowly check for `required` keyword's missingProperty. */
function getMissingProperty(e: ErrorObject): string | null {
  if (e.keyword !== 'required') return null;
  const p = (e as unknown as { params?: { missingProperty?: string } }).params;
  return p?.missingProperty ?? null;
}

/** Map a list of Ajv errors to a single, most-informative VerifyReason. */
export function mapAjvToReason(errors: readonly ErrorObject[]): VerifyReason {
  // Prefer signature-related issues first so we don't fall back to generic schema errors
  for (const e of errors) {
    const path = e.instancePath ?? '';

    // 1) Missing signature → SIGNATURE_BASE64_ERROR
    // Do NOT require exact '/seal' path; just check the missing property name.
    if (e.keyword === 'required' && getMissingProperty(e) === 'signature') {
      return 'SIGNATURE_BASE64_ERROR';
    }

    // 2) Signature format issues (pattern/contentEncoding) → SIGNATURE_BASE64_ERROR
    // Be flexible with the path: allow '/seal/signature' or anything ending in '/signature'
    if (
      (e.keyword === 'pattern' || e.keyword === 'contentEncoding') &&
      (path.endsWith('/signature'))
    ) {
      return 'SIGNATURE_BASE64_ERROR';
    }

    // 3) Unsupported algorithm via enum violation (keep as-is, but path-agnostic fallback)
    if (e.keyword === 'enum' && (path.endsWith('/seal/algo') || path.endsWith('/algo'))) {
      return 'ALGO_UNSUPPORTED';
    }
  }
  return 'SCHEMA_INVALID';
}