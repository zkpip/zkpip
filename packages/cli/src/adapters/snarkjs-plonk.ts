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

export function extractTriplet(input: unknown): Extracted {
  // Normalize root
  const root = getRec(input);

  // 1) New schema — artifacts.path (directory with verification/proof/public files)
  const artifacts = getRec(root?.artifacts);
  const artPath =
    typeof artifacts?.path === 'string' && artifacts.path.length > 0 ? artifacts.path : undefined;
  if (artPath) {
    return readArtifactsFromDir(artPath);
  }

  // 2) New schema — artifacts.{vkey,proof,publicSignals}.path (individual file refs)
  const vkeyRef = getRec(artifacts?.vkey);
  const proofRef = getRec(artifacts?.proof);
  const publicsRef = getRec(artifacts?.publicSignals);

  const vkeyPath =
    typeof vkeyRef?.path === 'string' && vkeyRef.path.length > 0 ? vkeyRef.path : undefined;
  const proofPath =
    typeof proofRef?.path === 'string' && proofRef.path.length > 0 ? proofRef.path : undefined;
  const publicsPath =
    typeof publicsRef?.path === 'string' && publicsRef.path.length > 0 ? publicsRef.path : undefined;

  if (vkeyPath && proofPath && publicsPath) {
    // Load files referenced by ArtifactRef.path
    const vkeyObj = JSON.parse(readFileSync(vkeyPath, 'utf8')) as Record<string, unknown>;
    const proofRaw = JSON.parse(readFileSync(proofPath, 'utf8')) as unknown;
    const publicsRaw = JSON.parse(readFileSync(publicsPath, 'utf8')) as unknown;

    // PLONK: proof may be a string or an object
    const proof: Record<string, unknown> | string =
      typeof proofRaw === 'string' ? proofRaw : (proofRaw as Record<string, unknown>);

    const publics =
      Array.isArray(publicsRaw) ? stringifyPublics(publicsRaw) : stringifyPublics([publicsRaw]);

    return { verificationKey: vkeyObj, proof, publics };
  }

  // 3) Legacy fields — support bundle/result and mixed key names
  const bundle = getRec(root?.bundle);
  const result = getRec(root?.result);

  const vkey =
    getKey<Record<string, unknown>>(root, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(bundle, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(result, ['verificationKey', 'verification_key']) ??
    {};

  // PLONK: proof can be string or object in legacy payloads as well
  const legacyProof =
    getKey<Record<string, unknown> | string>(root, ['proof']) ??
    getKey<Record<string, unknown> | string>(bundle, ['proof']) ??
    getKey<Record<string, unknown> | string>(result, ['proof']) ??
    {};

  const publicsUnknown =
    getKey<readonly unknown[]>(root, ['publicSignals', 'publics', 'public', 'inputs']) ??
    getKey<readonly unknown[]>(bundle, ['publicSignals', 'publics', 'public', 'inputs']) ??
    getKey<readonly unknown[]>(result, ['publicSignals', 'publics', 'public', 'inputs']) ??
    [];

  const publics = Array.isArray(publicsUnknown) ? stringifyPublics(publicsUnknown) : [];

  return { verificationKey: vkey, proof: legacyProof, publics };
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
  extractTriplet
};
