// src/adapters/snarkjsRuntime.ts
// ESM, NodeNext, strict TS, no "any".
// Lazy loads snarkjs and exposes stable, typed verify wrappers for Groth16 and PLONK.
// - Always stringifies publicSignals
// - Pre-validates numeric-like (decimal or 0x-hex) signals
// - Maps snarkjs BigInt-conversion errors to `false` (verification_failed upstream)
// - Caches verify functions between calls

export type Groth16VerifyFn = (
  vk: object,
  publicSignals: ReadonlyArray<string>,
  proof: object,
) => Promise<boolean>;

export type PlonkVerifyFn = (
  vk: object,
  publicSignals: ReadonlyArray<string>,
  proof: object | string,
) => Promise<boolean>;

let groth16VerifyCache: Groth16VerifyFn | undefined;
let plonkVerifyCache: PlonkVerifyFn | undefined;

type SnarkGroth16 = {
  readonly verify: (
    vk: object,
    publicSignals: ReadonlyArray<string>,
    proof: object,
  ) => boolean | Promise<boolean>;
};

type SnarkPlonk = {
  readonly verify: (
    vk: object,
    publicSignals: ReadonlyArray<string>,
    proof: object | string,
  ) => boolean | Promise<boolean>;
};

type SnarkModule = {
  readonly groth16?: SnarkGroth16;
  readonly plonk?: SnarkPlonk;
};

// --------- helpers ---------

function isFast(): boolean {
  return process.env.ZKPIP_FAST_RUNTIME === '1' || process.env.ZKPIP_MOCK_RUNTIME === '1';
}

function isSignalArray(v: unknown): v is ReadonlyArray<unknown> {
  return Array.isArray(v);
}

function isProofLike(v: unknown): v is object | string {
  return (typeof v === 'object' && v !== null) || typeof v === 'string';
}

/** Convert mixed values (string | number | bigint | other) to strings safely. */
function toSignalStrings(values: ReadonlyArray<unknown>): string[] {
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
    // Fallback to JSON for exotic cases; snarkjs will reject non-numeric later.
    return JSON.stringify(v);
  });
}

/** Accepts decimal (e.g. 123, -5) or 0x-hex (case-insensitive). */
function isNumericLike(s: string): boolean {
  return /^-?\d+$/.test(s) || /^0x[0-9a-fA-F]+$/.test(s);
}

async function loadSnarkjs(): Promise<SnarkModule> {
  // Dynamic ESM import compatible with both default and named exports
  const mod: unknown = await import('snarkjs');
  const snark = (mod as { default?: unknown }).default ?? mod;
  return snark as SnarkModule;
}

function shouldMapToFalse(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  // Common messages from snarkjs or BigInt coercion paths
  return (
    msg.includes('bigint') ||
    msg.includes('cannot convert') ||
    msg.includes('not a valid') ||
    msg.includes('invalid') // keep broad but harmless (we map only to false)
  );
}

// --------- public API ---------

export async function getGroth16Verify(): Promise<Groth16VerifyFn> {
  if (groth16VerifyCache) return groth16VerifyCache;

  if (isFast()) {
    return async () => true;
  }

  const snark = await loadSnarkjs();
  const verify = snark.groth16?.verify;
  if (!verify) {
    throw new Error('snarkjs.groth16.verify is unavailable');
  }

  const wrapped: Groth16VerifyFn = async (
    vk: object,
    publicSignals: ReadonlyArray<string>,
    proof: object,
  ): Promise<boolean> => {
    // Even if caller provided strings, ensure stable normalization
    const normalized = toSignalStrings(publicSignals as ReadonlyArray<unknown>);

    // Pre-validate: all signals must be numeric-like
    if (!normalized.every(isNumericLike)) {
      return false;
    }

    try {
      const res = await verify(vk, normalized, proof);
      return Boolean(res);
    } catch (err) {
      if (shouldMapToFalse(err)) return false;
      throw err;
    }
  };

  groth16VerifyCache = wrapped;
  return groth16VerifyCache;
}

export async function getPlonkVerify(): Promise<PlonkVerifyFn> {
  if (plonkVerifyCache) return plonkVerifyCache;

  if (isFast()) {
    return async () => true;
  }  

  const snark = await loadSnarkjs();
  const verify = snark.plonk?.verify;
  if (!verify) {
    throw new Error('snarkjs.plonk.verify is unavailable');
  }

  // We accept callers that might swap (signals, proof) by mistake.
  const wrapped = async (vk: object, arg2: unknown, arg3: unknown): Promise<boolean> => {
    let signalsLike: ReadonlyArray<unknown>;
    let proofLike: object | string;

    if (isSignalArray(arg2) && isProofLike(arg3)) {
      signalsLike = arg2;
      proofLike = arg3 as object | string;
    } else if (isProofLike(arg2) && isSignalArray(arg3)) {
      signalsLike = arg3;
      proofLike = arg2 as object | string;
    } else {
      // Fallback to the declared signature; this keeps types coherent too.
      if (!isSignalArray(arg2) || !isProofLike(arg3)) {
        throw new Error(
          'snarkjs-plonk verify: cannot determine argument order (expected (vk, signals[], proof)).',
        );
      }
      signalsLike = arg2;
      proofLike = arg3 as object | string;
    }

    const normalized = toSignalStrings(signalsLike);

    // Pre-validate: return false for non-numeric-like signals (treat as invalid proof)
    if (!normalized.every(isNumericLike)) {
      return false;
    }

    try {
      const res = await verify(vk, normalized, proofLike);
      return Boolean(res);
    } catch (err) {
      // snarkjs may throw on invalid publics -> treat as verification_failed
      if (shouldMapToFalse(err)) return false;
      throw err;
    }
  };

  // Cast to the public, stricter signature
  plonkVerifyCache = wrapped as PlonkVerifyFn;
  return plonkVerifyCache;
}
