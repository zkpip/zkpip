import {
  Adapter,
  AdapterKind,
  BatchResult,
  ProofBundle,
  AdapterVerifyResult,
  isBundleForAdapter,
} from '@zkpip/core';

// sealBatch is generic over adapter kind K
export async function sealBatch<K extends AdapterKind>(
  adapter: Adapter<K>,
  vectors: ProofBundle[],
): Promise<BatchResult> {
  const results: AdapterVerifyResult[] = [];

  for (const v of vectors) {
    if (isBundleForAdapter(adapter, v)) {
      // Here TypeScript knows v is BundleByKind<K>
      results.push(await adapter.verify(v));
    } else {
      results.push({
        ok: false,
        adapter: adapter.kind,
        bundleId: v.id,
        code: 'WRONG_ADAPTER',
        message: `Expected ${adapter.kind}, got ${v.adapter}`,
      });
    }
  }

  const passed = results.filter(r => r.ok).length;
  return {
    adapter: adapter.kind,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
