import type { Adapter, StarkBundle, AdapterVerifyResult } from '@zkpip/core';

// Dummy STARK adapter implementation
export const starkAdapter: Adapter<'stark'> = {
  kind: 'stark',
  async verify(bundle: StarkBundle): Promise<AdapterVerifyResult> {
    if (bundle.adapter !== 'stark') {
      return {
        ok: false,
        adapter: 'stark',
        bundleId: bundle.id,
        code: 'WRONG_ADAPTER',
        message: 'Expected stark bundle',
      };
    }
    return {
      ok: true,
      adapter: 'stark',
      bundleId: bundle.id,
      metrics: { mock: 'stark' },
    };
  },
};
