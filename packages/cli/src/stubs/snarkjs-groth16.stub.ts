import type { Adapter } from '../registry/types.js';

function readStr(x: any): string {
  return (x ?? '').toString().toLowerCase();
}
function getField(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = k.split('.').reduce((acc: any, part: string) => (acc ? acc[part] : undefined), obj);
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

export const snarkjsGroth16Stub: Adapter = {
  id: 'snarkjs-groth16',
  proofSystem: 'Groth16',
  framework: 'snarkjs',
  canHandle(bundle: any) {
    const ps =
      getField(bundle, ['proofSystem', 'meta.proofSystem', 'system', 'provingScheme']) ?? '';
    const fw =
      getField(bundle, [
        'framework',
        'meta.framework',
        'tool',
        'library',
        'meta.implementation',
        'prover.name',
      ]) ?? '';

    const psL = readStr(ps);
    const fwL = readStr(fw);

    // Accept groth16 by various spellings, and snarkjs hints
    const isGroth = psL.includes('groth') || psL === 'g16' || psL === 'groth16';
    const isSnarkjs = fwL.includes('snarkjs') || fwL.includes('circom') || fwL.includes('zkey');

    return isGroth && isSnarkjs;
  },
  async verify(_bundle: any) {
    return { ok: false, adapter: 'snarkjs-groth16', error: 'not_implemented' };
  },
};
