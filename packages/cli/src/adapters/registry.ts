// Minimal, ESM-safe adapter registry with a soft shape.
export interface Adapter {
  verify?: (...args: unknown[]) => unknown;
  validate?: (...args: unknown[]) => unknown;
  prove?: (...args: unknown[]) => unknown;
  id?: string;
}

// Import the existing adapter module (adjust path/name if different)
import * as snarkjsGroth16Mod from "./snarkjs-groth16.js";

// Support both default and named export shapes
const snarkjsGroth16: Adapter =
  (snarkjsGroth16Mod as unknown as { default?: Adapter }).default ??
  (snarkjsGroth16Mod as unknown as Adapter);

export const adaptersRegistry: Record<string, Adapter> = {
  "snarkjs-groth16": snarkjsGroth16,
};

// Optional helper if you want a lookup API
export function getAdapter(name: string): Adapter | undefined {
  const key = name in adaptersRegistry ? name : name.replace(/_/g, "-");
  return adaptersRegistry[key];
}
