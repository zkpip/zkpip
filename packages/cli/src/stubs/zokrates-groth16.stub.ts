import type { Adapter, VerificationLike, AdapterVerifyResult } from '../registry/types.js';

export const zokratesGroth16Stub: Adapter = {
  id: 'zokrates-groth16',
  proofSystem: 'Groth16',
  framework: 'zokrates',
  canHandle(input: VerificationLike): boolean {
    const ps = (input.proofSystem ?? input.meta?.proofSystem)?.toLowerCase?.();
    const fw = (input.framework ?? input.meta?.framework)?.toLowerCase?.();
    return ps === 'groth16' || fw === 'zokrates';
  },
  async verify(_input: VerificationLike): Promise<AdapterVerifyResult> {
    return { ok: false, adapter: 'zokrates-groth16', error: 'not_implemented' };
  },
};
