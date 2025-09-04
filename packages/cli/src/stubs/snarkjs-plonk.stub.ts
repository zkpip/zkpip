import type { Adapter, VerificationLike, AdapterVerifyResult } from '../registry/types.js';

export const snarkjsPlonkStub: Adapter = {
  id: 'snarkjs-plonk',
  proofSystem: 'Plonk',
  framework: 'snarkjs',
  canHandle(input: VerificationLike): boolean {
    const ps = (input.proofSystem ?? input.meta?.proofSystem)?.toLowerCase?.();
    const fw = (input.framework ?? input.meta?.framework)?.toLowerCase?.();
    // lazább detektálás: bármelyik elég
    return ps === 'plonk' || fw === 'snarkjs';
  },
  async verify(_input: VerificationLike): Promise<AdapterVerifyResult> {
    return { ok: false, adapter: 'snarkjs-plonk', error: 'not_implemented' };
  },
};

