import type { Adapter } from './types.js';
import { snarkjsGroth16 } from '../adapters/snarkjs-groth16.js';
import { snarkjsPlonk } from '../adapters/snarkjs-plonk.js';
import { zokratesGroth16 } from "../adapters/zokrates-groth16.js";

const ADAPTERS: Adapter[] = [snarkjsGroth16, snarkjsPlonk, zokratesGroth16];

// Derive the detection input type from the Adapter interface
type DetectInput = Parameters<Adapter['canHandle']>[0];

export function getAllAdapters(): readonly Adapter[] {
  return ADAPTERS;
}

export function pickAdapter(bundle: DetectInput): Adapter | undefined {
  return ADAPTERS.find((a) => a.canHandle(bundle));
}

export function getAdapterById(id: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

export const availableAdapterIds = ADAPTERS.map((a) => a.id);
