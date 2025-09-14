// ESM + NodeNext, strict TS, no "any".
// snarkjs PLONK adapter with:
// - robust extraction (bundle/flat/artifacts.path)
// - publics → string[]
// - optional injected verify() for tests
// - protocol guard
// - normalized dumps pre/post

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPlonkVerify } from '../adapters/snarkjsRuntime.js';
import { dumpNormalized, stringifyPublics } from '../utils/dumpNormalized.js';

export const ID = 'snarkjs-plonk' as const;
export const PROOF_SYSTEM = 'plonk' as const;
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
  readonly proof: Record<string, unknown> | string;
  readonly publics: readonly string[];
};

function readArtifactsFromDir(dir: string): Extracted {
  const p = (name: string) => resolve(dir, name);
  const vkey = JSON.parse(readFileSync(p('verification_key.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const proof = JSON.parse(readFileSync(p('proof.json'), 'utf8')) as
    | Record<string, unknown>
    | string;
  const publicsRaw = JSON.parse(readFileSync(p('public.json'), 'utf8')) as unknown[];
  const publics = stringifyPublics(publicsRaw);
  return { verificationKey: vkey, proof, publics };
}

/**
 * Accepts:
 *  - flat: { verification_key|verificationKey, proof, public|publics|publicSignals }
 *  - bundle: { bundle: { ... } }
 *  - artifacts.path: { artifacts: { path: "/abs/or/rel/dir" } }  <-- unit tests expect this
 */
function extractTriplet(input: unknown): Extracted {
  const root = getRec(input);
  const artifacts = getRec(root?.artifacts);
  const artPath =
    artifacts?.path && typeof artifacts.path === 'string' ? artifacts.path : undefined;
  if (artPath) return readArtifactsFromDir(artPath);

  const bundle = getRec(root?.bundle);

  const vkey =
    getKey<Record<string, unknown>>(root, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(bundle, ['verificationKey', 'verification_key']) ??
    {};

  const proof =
    getKey<Record<string, unknown> | string>(root, ['proof']) ??
    getKey<Record<string, unknown> | string>(bundle, ['proof']) ??
    {};

  const publicsUnknown =
    getKey<readonly unknown[]>(root, ['publicSignals', 'publics', 'public']) ??
    getKey<readonly unknown[]>(bundle, ['publicSignals', 'publics', 'public']) ??
    [];

  const publics = Array.isArray(publicsUnknown) ? stringifyPublics(publicsUnknown) : [];

  return { verificationKey: vkey, proof, publics };
}

export function canHandle(input: unknown): boolean {
  try {
    const e = extractTriplet(input);
    const vkeyOk = isRec(e.verificationKey) && Object.keys(e.verificationKey).length > 0;
    const proofOk =
      (isRec(e.proof) && Object.keys(e.proof).length > 0) || typeof e.proof === 'string';
    const publicsOk = Array.isArray(e.publics);
    return vkeyOk && proofOk && publicsOk;
  } catch {
    return false;
  }
}

export type PlonkInjectedVerify = (
  vk: object,
  publics: ReadonlyArray<string>,
  proof: object | string,
) => Promise<boolean> | boolean;

export async function verify(
  input: unknown,
  opts?: { readonly verify?: PlonkInjectedVerify }, // <-- unit tests can inject stub
): Promise<boolean> {
  // preExtract meta
  await dumpNormalized(ID, 'preExtract', {
    meta: { framework: FRAMEWORK, proofSystem: PROOF_SYSTEM },
  });

  const ex = extractTriplet(input);

  // protocol guard (if present)
  const proto = (ex.verificationKey as Record<string, unknown>)['protocol'];
  if (typeof proto === 'string' && proto.toLowerCase() !== PROOF_SYSTEM) {
    throw new Error(`protocol mismatch: expected ${PROOF_SYSTEM}, got ${proto}`);
  }

  // postExtract dump
  await dumpNormalized(ID, 'postExtract', {
    vkey: ex.verificationKey,
    proof: isRec(ex.proof) ? ex.proof : { proof: ex.proof },
    publics: ex.publics,
    normalized: {
      verificationKey: ex.verificationKey,
      proof: isRec(ex.proof) ? ex.proof : { proof: ex.proof },
      publics: ex.publics,
    },
  });

  // resolve verifier (injected for unit tests or real snarkjs)
  const doVerify = opts?.verify ?? (await getPlonkVerify());
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
