// ESM + NodeNext, strict TS, no "any".
// snarkjs Groth16 adapter with artifacts.path support + injected verify for unit tests.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  const artifacts = getRec(root?.artifacts);
  const artPath =
    artifacts?.path && typeof artifacts.path === 'string' ? artifacts.path : undefined;
  if (artPath) return readArtifactsFromDir(artPath);

  const bundle = getRec(root?.bundle);
  const result = getRec(root?.result);

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

export type GrothInjectedVerify = (
  vk: object,
  publics: ReadonlyArray<string>,
  proof: object,
) => Promise<boolean> | boolean;

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
