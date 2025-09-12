// ESM + NodeNext, strict TS, no "any".
// Adapter for snarkjs PLONK: robust extraction + stringified publics + stable dumps.

import { getPlonkVerify } from './snarkjsRuntime.js';
import { dumpNormalized } from '../utils/dumpNormalized.js';

export const ID = 'snarkjs-plonk' as const;
export const PROOF_SYSTEM = 'plonk' as const;
export const FRAMEWORK = 'snarkjs' as const;

function isRec(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function getRec(v: unknown): Record<string, unknown> | undefined {
  return isRec(v) ? (v as Record<string, unknown>) : undefined;
}

/** Lookup helper that never returns boolean, only T | undefined. */
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

/** Make a stable string[] out of arbitrary mixed numeric/string inputs. */
function toStringArray(values: readonly unknown[]): readonly string[] {
  return values.map((v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'bigint') return v.toString(10);
    try {
      const s = (v as { toString?: () => string } | null)?.toString?.();
      if (s && s !== '[object Object]') return String(s);
    } catch {
      /* noop */
    }
    return JSON.stringify(v);
  });
}

type Extracted = {
  readonly verificationKey: Record<string, unknown>;
  readonly proof: Record<string, unknown> | string;
  readonly publics: readonly string[];
};

/**
 * Accepts:
 *  - flat: { verification_key|verificationKey, proof, public|publics|publicSignals }
 *  - bundle: { bundle: { ...same keys... } }
 *  - artifacts: { artifacts: { bundle?: { ... }, verification_key?: ... , proof?: ... } }
 */
function extractTriplet(input: unknown): Extracted {
  const root = getRec(input);
  const bundle = getRec(root?.bundle);
  const artifacts = getRec(root?.artifacts);
  const artBundle = getRec(artifacts?.bundle);

  // vkey
  const vkey =
    getKey<Record<string, unknown>>(root, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(bundle, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(artBundle, ['verificationKey', 'verification_key']) ??
    getKey<Record<string, unknown>>(artifacts, ['verificationKey', 'verification_key']) ??
    {};

  // proof (can be object or string, snarkjs tolerates both)
  const proof =
    getKey<Record<string, unknown> | string>(root, ['proof']) ??
    getKey<Record<string, unknown> | string>(bundle, ['proof']) ??
    getKey<Record<string, unknown> | string>(artBundle, ['proof']) ??
    getKey<Record<string, unknown> | string>(artifacts, ['proof']) ??
    {};

  // publics
  const publicsUnknown =
    getKey<readonly unknown[]>(root, ['publicSignals', 'publics', 'public']) ??
    getKey<readonly unknown[]>(bundle, ['publicSignals', 'publics', 'public']) ??
    getKey<readonly unknown[]>(artBundle, ['publicSignals', 'publics', 'public']) ?? // usually 'public' here
    getKey<readonly unknown[]>(artifacts, ['publicSignals', 'publics', 'public']) ??
    [];

  const publics = Array.isArray(publicsUnknown) ? toStringArray(publicsUnknown) : [];

  return { verificationKey: vkey, proof, publics };
}

// ---- Capability detection ----
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

// ---- Verify ----
export async function verify(input: unknown): Promise<boolean> {
  // preExtract meta (sync dump)
  dumpNormalized(ID, 'preExtract', {
    meta: {
      framework: 'snarkjs',
      proofSystem: 'plonk',
      node: process.version,
      inputKind: 'verification-json',
    },
  });

  const ex = extractTriplet(input);

  // postExtract artifacts
  dumpNormalized(ID, 'postExtract', {
    vkey: ex.verificationKey,
    proof: isRec(ex.proof) ? ex.proof : { proof: ex.proof },
    publics: ex.publics,
    normalized: {
      verificationKey: ex.verificationKey,
      proof: isRec(ex.proof) ? ex.proof : { proof: ex.proof },
      publics: ex.publics,
    },
  });

  const nPublic = Number(
    (ex.verificationKey as Record<string, unknown>)['nPublic'] ?? ex.publics.length,
  );
  if (!Number.isNaN(nPublic) && ex.publics.length !== nPublic) {
    // preemptive fail: bad input bundle
    dumpNormalized(ID, 'postVerify', {
      meta: { verifyOk: false, reason: 'nPublic_mismatch', nPublic, publics: ex.publics.length },
    });
    return false;
  }

  // verify via snarkjs runtime (getPlonkVerify signature)
  const plonkVerify = await getPlonkVerify();
  const ok = await plonkVerify(ex.verificationKey, ex.publics, ex.proof);

  dumpNormalized(ID, 'postVerify', { meta: { verifyOk: ok } });
  return ok;
}

// Optional object shape if your registry expects it
export const snarkjsPlonkAdapter = {
  id: ID,
  proofSystem: PROOF_SYSTEM,
  framework: FRAMEWORK,
  canHandle,
  verify,
};

export default snarkjsPlonkAdapter;
