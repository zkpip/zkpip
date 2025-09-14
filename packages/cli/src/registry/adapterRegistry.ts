// packages/cli/src/registry/adapterRegistry.ts
import type { Adapter } from './types.js';

type AdapterModule = {
  readonly default?: unknown;
} & Record<string, unknown>;

/** Runtime check: must have string id AND function verify */
function isAdapter(x: unknown): x is Adapter {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.verify === 'function' &&
    typeof r.proofSystem === 'string' &&
    typeof r.framework === 'string'
  );
}

/** Load a module and pick default, requested, or common fallbacks like `adapter`. */
async function loadNamed(modulePath: string, exportName: string): Promise<Adapter> {
  const mod = (await import(modulePath)) as AdapterModule;

  // Try default → requested name → common fallbacks
  const candidate =
    (mod.default as unknown) ??
    (mod[exportName] as unknown) ??
    (mod.adapter as unknown) ?? // <-- important fallback
    (mod.Adapter as unknown) ?? // optional legacy
    (mod.ADAPTER as unknown); // optional legacy

  if (isAdapter(candidate)) return candidate;

  const available = Object.keys(mod).join(', ') || '(no named exports)';
  throw new Error(
    `Invalid adapter export in ${modulePath} (expected Adapter at "${exportName}" or default; saw: ${available})`,
  );
}

export const LOADERS = {
  'snarkjs-groth16': () => loadNamed('../adapters/snarkjs-groth16.js', 'snarkjsGroth16'),
  'snarkjs-plonk': () => loadNamed('../adapters/snarkjs-plonk.js', 'snarkjsPlonk'),
  'zokrates-groth16': () => loadNamed('../adapters/zokrates-groth16.js', 'zokratesGroth16'),
} as const;

export type AdapterId = keyof typeof LOADERS;
export const availableAdapterIds = Object.keys(LOADERS) as readonly AdapterId[];

export async function resolveAdapter(id: AdapterId): Promise<Adapter> {
  return LOADERS[id]();
}

export function isAdapterId(s: string): s is AdapterId {
  return (availableAdapterIds as readonly string[]).includes(s);
}

export async function getAllAdapters(): Promise<Adapter[]> {
  const out: Adapter[] = [];
  for (const id of availableAdapterIds) {
    out.push(await LOADERS[id]());
  }
  return out;
}

export async function getAdapterById(id: AdapterId): Promise<Adapter> {
  return LOADERS[id]();
}
