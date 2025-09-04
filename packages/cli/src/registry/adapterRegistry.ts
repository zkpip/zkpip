import type { Adapter } from './types.js';
import { snarkjsGroth16 } from '../adapters/snarkjs-groth16.js';
import { snarkjsPlonkStub } from '../stubs/snarkjs-plonk.stub.js';
import { zokratesGroth16Stub } from '../stubs/zokrates-groth16.stub.js';

const registry: Adapter[] = [snarkjsGroth16, snarkjsPlonkStub, zokratesGroth16Stub];

export function pickAdapter(bundle: any): Adapter | undefined {
  return registry.find((a) => a.canHandle(bundle));
}
export function getAdapterById(id: string): Adapter | undefined {
  return registry.find((a) => a.id === id);
}
