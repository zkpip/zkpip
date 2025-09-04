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

export const snarkjsPlonkStub: Adapter = {
  id: 'snarkjs-plonk',
  proofSystem: 'Plonk',
  framework: 'snarkjs',
  canHandle(bundle: any) {
    const ps =
      getField(bundle, ['proofSystem', 'meta.proofSystem', 'system', 'provingScheme']) ?? '';
    const fw =
      getField(bundle, ['framework', 'meta.framework', 'tool', 'library', 'meta.implementation']) ??
      '';
    const psL = readStr(ps),
      fwL = readStr(fw);
    const isPlonk = psL.includes('plonk');
    const isSnarkjs = fwL.includes('snarkjs') || fwL.includes('circom');
    return isPlonk && isSnarkjs;
  },
  async verify(_bundle: any) {
    return { ok: false, adapter: 'snarkjs-plonk', error: 'not_implemented' };
  },
};
