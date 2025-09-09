// packages/cli/src/registry/adapterRegistry.ts
import type { Adapter } from './types.js';

type ModGroth16 = typeof import('../adapters/snarkjs-groth16.js');
type ModPlonk   = typeof import('../adapters/snarkjs-plonk.js');
type ModZoG16   = typeof import('../adapters/zokrates-groth16.js');

const LOADERS = {
  'snarkjs-groth16': async () =>
    (await import('../adapters/snarkjs-groth16.js') as ModGroth16).snarkjsGroth16,
  'snarkjs-plonk': async () =>
    (await import('../adapters/snarkjs-plonk.js') as ModPlonk).snarkjsPlonk,
  'zokrates-groth16': async () =>
    (await import('../adapters/zokrates-groth16.js') as ModZoG16).zokratesGroth16,
} as const;

export type AdapterId = keyof typeof LOADERS;
export const availableAdapterIds = Object.keys(LOADERS) as readonly AdapterId[];

// Narrow string → AdapterId
export function isAdapterId(s: string): s is AdapterId {
  return (availableAdapterIds as readonly string[]).includes(s);
}

// Typed returns
export async function getAllAdapters(): Promise<Adapter<AdapterId>[]> {
  const out: Adapter<AdapterId>[] = [];
  for (const id of availableAdapterIds) {
    const a = (await LOADERS[id]()) as Adapter<AdapterId>;
    out.push(a);
  }
  return out;
}

export async function getAdapterById(id: AdapterId): Promise<Adapter<AdapterId>> {
  return LOADERS[id]() as Promise<Adapter<AdapterId>>;
}
