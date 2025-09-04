export interface Adapter {
  id: string; // e.g., "snarkjs-groth16"
  proofSystem: 'Groth16' | 'Plonk';
  framework: 'snarkjs' | 'zokrates';
  canHandle(bundle: any): boolean;
  verify(bundle: any): Promise<{ ok: boolean; adapter: string; error?: string }>;
}
