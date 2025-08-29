import type { Adapter, PlonkBundle, AdapterVerifyResult } from '@zkpip/core';

// Dummy Plonk adapter implementation
export const plonkAdapter: Adapter<'plonk'> = {
  kind: 'plonk',
  async verify(bundle: PlonkBundle): Promise<AdapterVerifyResult> {
    if (bundle.adapter !== 'plonk') {
      return {
        ok: false,
        adapter: 'plonk',
        bundleId: bundle.id,
        code: 'WRONG_ADAPTER',
        message: 'Expected plonk bundle',
      };
    }
    return {
      ok: true,
      adapter: 'plonk',
      bundleId: bundle.id,
      metrics: { mock: 'plonk' },
    };
  },
};
