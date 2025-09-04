export type VerificationLike = {
  proofSystem?: string;
  framework?: string;
  recordType?: string;
  proof?: unknown;
  publicInputs?: unknown;
  meta?: {
    proofSystem?: string;
    framework?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

// Verify output
export type AdapterVerifyResult =
  | { ok: true; adapter: string }
  | { ok: false; adapter: string; error: 'verification_failed' | 'not_implemented' | string };

// Adapter interface 
export interface Adapter {
  /** e.g. "snarkjs-groth16" */
  id: string;
  proofSystem: 'Groth16' | 'Plonk';
  framework: 'snarkjs' | 'zokrates';

  canHandle(input: VerificationLike): boolean;

  verify(input: VerificationLike): Promise<AdapterVerifyResult>;
}