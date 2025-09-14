// ESM + NodeNext, strict TS, no "any".
// ZoKrates Groth16 adapter with artifacts.path support + injected verify + gamma_abc guard.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getGroth16Verify } from '../adapters/snarkjsRuntime.js';
import { dumpNormalized, stringifyPublics } from '../utils/dumpNormalized.js';

type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | { readonly [k: string]: Json } | readonly Json[];

export const ID = 'zokrates-groth16' as const;
export const PROOF_SYSTEM = 'groth16' as const;
export const FRAMEWORK = 'zokrates' as const;

function isRec(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function getRec(v: unknown): Record<string, unknown> | undefined {
  return isRec(v) ? (v as Record<string, unknown>) : undefined;
}
function getKey<T>(
  obj: Record<string, unknown> | undefined,
  keys: readonly string[],
): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      return obj[k] as T;
    }
  }
  return undefined;
}

type Extracted = {
  readonly verificationKey: Record<string, unknown>;
  readonly proof: Record<string, unknown>;
  readonly publics: readonly string[];
};

function readArtifactsFromDir(dir: string): Extracted {
  const p = (name: string) => resolve(dir, name);
  const vkey = JSON.parse(readFileSync(p('verification_key.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const proof = JSON.parse(readFileSync(p('proof.json'), 'utf8')) as Record<string, unknown>;
  const publicsRaw = JSON.parse(readFileSync(p('public.json'), 'utf8')) as unknown[];
  const publics = stringifyPublics(publicsRaw);
  return { verificationKey: vkey, proof, publics };
}

function extractTriplet(input: unknown): Extracted {
  const root = getRec(input);
  const bundle = getRec(root?.bundle);
  const result = getRec(root?.result);
  const artifacts = getRec(root?.artifacts);
  const artPath = typeof artifacts?.path === 'string' ? artifacts.path : undefined;

  // 1) Prefer embedded fields (CI/offline friendly)
  const vkey =
    getKey<Record<string, unknown>>(root, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(bundle, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(result, ['verificationKey', 'verification_key']) ??
    {};

  const proof =
    getKey<Record<string, unknown>>(root, ['proof']) ??
    getKey<Record<string, unknown>>(bundle, ['proof']) ??
    getKey<Record<string, unknown>>(result, ['proof']) ??
    {};

  const publicsUnknown =
    getKey<readonly unknown[]>(root, ['publicSignals', 'publics', 'public', 'inputs']) ??
    getKey<readonly unknown[]>(bundle, ['publicSignals', 'publics', 'public', 'inputs']) ??
    getKey<readonly unknown[]>(result, ['publicSignals', 'publics', 'public', 'inputs']) ??
    [];

  const publics = Array.isArray(publicsUnknown) ? stringifyPublics(publicsUnknown) : [];

  const haveEmbedded =
    Object.keys(vkey).length > 0 && Object.keys(proof).length > 0 && publics.length > 0;

  if (haveEmbedded) {
    return { verificationKey: vkey, proof, publics };
  }

  // 2) Fallback: read from artifacts.path if present (safe, best-effort)
  if (artPath) {
    try {
      return readArtifactsFromDir(artPath);
    } catch {
      // ignore and continue
    }
  }

  // 3) Return whatever we found (canHandle/verify will handle empties)
  return { verificationKey: vkey, proof, publics };
}

/** Optional structural guard often used in unit tests. */
// Soft-check: record mismatch but do not throw; snarkjs.verify will decide.
function checkGammaAbcLength(
  vk: Record<string, unknown>,
  nPublics: number | undefined
): { ok: boolean; expect?: number; got?: number } {
  const gammaABC = (vk as Record<string, unknown>)['gamma_abc'] ?? (vk as Record<string, unknown>)['IC'];
  if (Array.isArray(gammaABC) && typeof nPublics === 'number') {
    const expect = nPublics + 1;
    const got = gammaABC.length;
    return { ok: got === expect, expect, got };
  }
  return { ok: true };
}

export function canHandle(input: unknown): boolean {
  try {
    const e = extractTriplet(input);
    const vkeyOk = isRec(e.verificationKey) && Object.keys(e.verificationKey).length > 0;
    const proofOk = isRec(e.proof) && Object.keys(e.proof).length > 0;
    const publicsOk = Array.isArray(e.publics);
    return vkeyOk && proofOk && publicsOk;
  } catch {
    return false;
  }
}

export type GrothInjectedVerify = (
  vk: object,
  publics: ReadonlyArray<string>,
  proof: object,
) => Promise<boolean> | boolean;

// helper: normalize protocol strings to a common token
function normProto(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'groth16' || s === 'g16' || s === 'groth-16') return 'groth16';
  return s;
}

/** Strict structural guard: throw if gamma_abc length != nPublics + 1 */
function assertGammaAbcLengthStrict(
  vk: Record<string, unknown>,
  nPublics: number | undefined,
): void {
  const gammaABC =
    (vk as Record<string, unknown>)['gamma_abc'] ??
    (vk as Record<string, unknown>)['IC']; // ZoKrates JSON vs snarkjs naming

  if (Array.isArray(gammaABC) && typeof nPublics === 'number') {
    const expect = nPublics + 1;
    const got = gammaABC.length;
    if (got !== expect) {
      // IMPORTANT: message must match the test’s regex
      throw new Error(`gamma_abc length mismatch: expected ${expect}, got ${got}`);
    }
  }
}

export async function verify(
  input: unknown,
  opts?: { readonly verify?: GrothInjectedVerify },
): Promise<boolean> {
  await dumpNormalized(ID, 'preExtract', {
    meta: { framework: FRAMEWORK, proofSystem: PROOF_SYSTEM },
  });

  const ex = extractTriplet(input);

  const proto = (ex.verificationKey as Record<string, unknown>)['protocol'];
  if (typeof proto === 'string' && proto.toLowerCase() !== PROOF_SYSTEM) {
    throw new Error(`protocol mismatch: expected ${PROOF_SYSTEM}, got ${proto}`);
  }

  // Derive expected #publics: prefer vk.nPublic if present, else publics length
  const nPublic =
    Number((ex.verificationKey as Record<string, unknown>)['nPublic']) ||
    (Array.isArray(ex.publics) ? ex.publics.length : undefined);

  // >>> restore STRICT guard (throws on mismatch, blocks runtime verify)
  assertGammaAbcLengthStrict(
    ex.verificationKey,
    Number.isFinite(nPublic) ? Number(nPublic) : undefined,
  );

  await dumpNormalized(ID, 'postExtract', {
    vkey: ex.verificationKey,
    proof: ex.proof as Json,
    publics: ex.publics,
    normalized: {
      verificationKey: ex.verificationKey,
      proof: ex.proof as Json,
      publics: ex.publics,
    },
  });

  // Only resolve verifier AFTER the guard (so spies aren't touched on failure)
  const doVerify = opts?.verify ?? (await getGroth16Verify());
  const ok = await doVerify(ex.verificationKey, ex.publics, ex.proof);

  await dumpNormalized(ID, 'postVerify', { meta: { verifyOk: ok } });
  return ok;
}

export default {
  id: ID,
  proofSystem: PROOF_SYSTEM,
  framework: FRAMEWORK,
  canHandle,
  verify,
};
