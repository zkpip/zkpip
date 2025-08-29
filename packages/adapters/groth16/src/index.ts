import type { Adapter, Groth16Bundle, AdapterVerifyResult } from '@zkpip/core';

// Minimal dummy adapter – replace with real verifier logic later
export const groth16Adapter: Adapter<'groth16'> = {
  kind: 'groth16',
  async verify(bundle: Groth16Bundle): Promise<AdapterVerifyResult> {
    if (bundle.adapter !== 'groth16') {
      return {
        ok: false,
        adapter: 'groth16',
        bundleId: bundle.id,
        code: 'WRONG_ADAPTER',
        message: 'Expected groth16 bundle',
      };
    }
    return {
      ok: true,
      adapter: 'groth16',
      bundleId: bundle.id,
      metrics: { mock: '1' },
    };
  },
};
