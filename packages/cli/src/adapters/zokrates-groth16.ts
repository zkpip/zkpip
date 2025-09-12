// ESM + NodeNext, strict TS, no "any".
// Adapter for ZoKrates Groth16: normalize → dump → snarkjs.groth16.verify via runtime.

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

function extractTriplet(input: unknown): Extracted {
  const root = getRec(input);
  const fromResult = getRec(root?.result); // common ZoKrates shape

  const vkey =
    getKey<Record<string, unknown>>(root, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(fromResult, ['verificationKey', 'verification_key']) ??
    {};

  const proof =
    getKey<Record<string, unknown>>(root, ['proof']) ??
    getKey<Record<string, unknown>>(fromResult, ['proof']) ??
    {};

  const publicsUnknown =
    getKey<readonly unknown[]>(root, ['publicSignals', 'publics', 'inputs', 'public']) ??
    getKey<readonly unknown[]>(fromResult, ['publicSignals', 'publics', 'inputs', 'public']) ??
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

export const zokratesGroth16Adapter = {
  id: ID,
  proofSystem: PROOF_SYSTEM,
  framework: FRAMEWORK,
  canHandle,
  verify,
};

export default zokratesGroth16Adapter;
