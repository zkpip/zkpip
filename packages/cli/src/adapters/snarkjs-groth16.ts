// ESM + NodeNext, strict TS, no "any".
// Adapter for snarkjs Groth16: robust extraction + dumps + runtime verify.

import { getGroth16Verify } from '../adapters/snarkjsRuntime.js';
import { dumpNormalized, stringifyPublics } from '../utils/dumpNormalized.js';

type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | { readonly [k: string]: Json } | readonly Json[];

export const ID = 'snarkjs-groth16' as const;
export const PROOF_SYSTEM = 'groth16' as const;
export const FRAMEWORK = 'snarkjs' as const;

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

function extractTriplet(input: unknown): Extracted {
  const root = getRec(input);
  const bundle = getRec(root?.bundle);
  const artifacts = getRec(root?.artifacts);
  const artBundle = getRec(artifacts?.bundle);

  const vkey =
    getKey<Record<string, unknown>>(root, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(bundle, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(artBundle, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(artifacts, ['verificationKey', 'verification_key']) ??
    {};

  const proof =
    getKey<Record<string, unknown>>(root, ['proof']) ??
    getKey<Record<string, unknown>>(bundle, ['proof']) ??
    getKey<Record<string, unknown>>(artBundle, ['proof']) ??
    getKey<Record<string, unknown>>(artifacts, ['proof']) ??
    {};

  const publicsUnknown =
    getKey<readonly unknown[]>(root, ['publicSignals', 'publics', 'public']) ??
    getKey<readonly unknown[]>(bundle, ['publicSignals', 'publics', 'public']) ??
    getKey<readonly unknown[]>(artBundle, ['publicSignals', 'publics', 'public']) ??
    getKey<readonly unknown[]>(artifacts, ['publicSignals', 'publics', 'public']) ??
    [];

  const publics = Array.isArray(publicsUnknown) ? stringifyPublics(publicsUnknown) : [];

  return { verificationKey: vkey, proof, publics };
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

export async function verify(input: unknown): Promise<boolean> {
  dumpNormalized(ID, 'preExtract', {
    meta: { framework: FRAMEWORK, proofSystem: PROOF_SYSTEM },
  });

  const ex = extractTriplet(input);

  dumpNormalized(ID, 'postExtract', {
    vkey: ex.verificationKey,
    proof: ex.proof as Json,
    publics: ex.publics,
    normalized: {
      verificationKey: ex.verificationKey,
      proof: ex.proof as Json,
      publics: ex.publics,
    },
  });

  const doVerify = await getGroth16Verify();
  const ok = await doVerify(ex.verificationKey, ex.publics, ex.proof);

  dumpNormalized(ID, 'postVerify', { meta: { verifyOk: ok } });
  return ok;
}

export const snarkjsGroth16Adapter = {
  id: ID,
  proofSystem: PROOF_SYSTEM,
  framework: FRAMEWORK,
  canHandle,
  verify,
};

export default snarkjsGroth16Adapter;
