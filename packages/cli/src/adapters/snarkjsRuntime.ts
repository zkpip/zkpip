// ESM, NodeNext, no "any". Lazy loads snarkjs and caches verify functions.

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

export async function getGroth16Verify(): Promise<Groth16VerifyFn> {
  if (groth16VerifyCache) return groth16VerifyCache;

  let mod: unknown;
  try {
    mod = await import('snarkjs');
  } catch {
    throw new Error(
      'snarkjs is not installed or not resolvable. Add it to dependencies and ensure ESM resolution.',
    );
  }

  type SnarkjsGrothShape = {
    groth16?: {
      verify: (vk: object, signals: ReadonlyArray<string>, proof: object) => Promise<boolean>;
    };
  };

  const snark = mod as SnarkjsGrothShape;
  const verify = snark.groth16?.verify;
  if (typeof verify !== 'function') {
    throw new Error('snarkjs.groth16.verify is not available on the loaded module.');
  }

  groth16VerifyCache = async (vk, signals, proof) => verify(vk, [...signals], proof);
  return groth16VerifyCache;
}

export async function getPlonkVerify(): Promise<PlonkVerifyFn> {
  if (plonkVerifyCache) return plonkVerifyCache;

  const mod: unknown = await import('snarkjs');

  type SnarkjsPlonkShape = {
    plonk?: {
      verify: (
        vk: object,
        signals: ReadonlyArray<string>,
        proof: object | string,
      ) => Promise<boolean>;
    };
  };

  const m = mod as SnarkjsPlonkShape;
  const verify = m.plonk?.verify;
  if (typeof verify !== 'function') {
    throw new Error('snarkjs.plonk.verify is not available on the loaded module.');
  }

  plonkVerifyCache = (vk, signals, proof) => verify(vk, [...signals], proof);
  return plonkVerifyCache;
}
