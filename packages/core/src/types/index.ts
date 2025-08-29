// packages/core/src/types/index.ts

// ===== Adapter kinds =====
// Use a narrow string union for stable discriminants across packages.
export type AdapterKind = 'groth16' | 'plonk' | 'stark';

// ===== Generic ProofBundle =====
// Minimal, transport-safe container. Payload is intentionally unknown at core level.
// Adapter-specific packages should validate/parse their own payloads.
export type ProofBundle = {
  id: string;            // logical identifier (e.g., filename, UUID)
  adapter: AdapterKind;  // discriminant to route to the correct adapter
  payload: unknown;      // opaque; adapter-specific structure
};

// ===== Discriminated bundles (by adapter kind) =====
// These refine the generic ProofBundle to enable type-safe adapter.verify() calls.
export type Groth16Bundle = ProofBundle & { adapter: 'groth16' };
export type PlonkBundle   = ProofBundle & { adapter: 'plonk' };
export type StarkBundle   = ProofBundle & { adapter: 'stark' };

// Map an AdapterKind K to its corresponding bundle type.
// This is used by the generic Adapter<K> interface.
export type BundleByKind<K extends AdapterKind> =
  K extends 'groth16' ? Groth16Bundle :
  K extends 'plonk'   ? PlonkBundle   :
  K extends 'stark'   ? StarkBundle   : never;

// ===== Verification result types =====
// Keep results canonical and adapter-agnostic so BatchSeal can aggregate uniformly.
export type AdapterVerifyOk = {
  ok: true;
  adapter: AdapterKind;
  bundleId: string;
  // Optional, adapter-defined metrics (e.g., proof size, verification time, circuit name).
  metrics?: Record<string, number | string>;
};

export type AdapterVerifyErr = {
  ok: false;
  adapter: AdapterKind;
  bundleId: string;
  // Canonical, machine-readable error code (documented in the error catalog).
  code: string;
  // Optional human-readable message for logs and DX.
  message?: string;
  // Optional adapter-defined diagnostics (e.g., stderr snippets, version info).
  diagnostics?: Record<string, unknown>;
};

export type AdapterVerifyResult = AdapterVerifyOk | AdapterVerifyErr;

// ===== Adapter interface (generic by kind) =====
// Implementations in adapter packages pick a concrete K (e.g., 'groth16')
// to get type-safe verify() signatures for their own bundle shape.
export interface Adapter<K extends AdapterKind> {
  kind: K;
  verify(bundle: BundleByKind<K>): Promise<AdapterVerifyResult>;
}

// ===== Batch aggregation result =====
// Produced by BatchSeal; summarizes pass/fail and carries all per-bundle results.
export type BatchResult = {
  adapter: AdapterKind;
  total: number;
  passed: number;
  failed: number;
  results: AdapterVerifyResult[];
};

// ===== Type guard to narrow bundles to a given adapter =====
// Useful for BatchSeal and CLI orchestration before calling adapter.verify().
export function isBundleForAdapter<K extends AdapterKind>(
  adapter: Adapter<K>,
  b: ProofBundle
): b is BundleByKind<K> {
  return b.adapter === adapter.kind;
}
