// NodeNext ESM, no "any". Registry for id→adapter module (no detection logic).
// ExactOptionalPropertyTypes-friendly.

import type { VerifyOutcome } from '../adapters/types.js';

// 1) Supported adapter IDs (extend as you add more)
export const availableAdapterIds = ['snarkjs-groth16'] as const;
export type AdapterId = typeof availableAdapterIds[number];

// 2) Minimal adapter module shape (matches new adapters)
export type AdapterModule = {
  id: AdapterId;
  verify: (bundlePath: string) => Promise<VerifyOutcome<AdapterId>>;
  proofSystem?: string;
  framework?: string;
};

export async function getAdapterById(id: AdapterId): Promise<AdapterModule | undefined> {
  switch (id) {
    case 'snarkjs-groth16': {
      const mod = await import('../adapters/snarkjs-groth16.js');
      return {
        id: mod.id,
        verify: mod.verify,
        // fallback-ek, ha nem exportálnád a konstansokat:
        proofSystem: mod.proofSystem ?? 'groth16',
        framework: mod.framework ?? 'snarkjs',
      } satisfies AdapterModule;
    }
    default:
      return undefined;
  }
}

export async function getAllAdapters(): Promise<readonly AdapterModule[]> {
  const mods = await Promise.all(availableAdapterIds.map(getAdapterById));
  return mods.filter((m): m is AdapterModule => !!m);
}

