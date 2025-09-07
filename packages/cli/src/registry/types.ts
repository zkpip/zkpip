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

export type DetectInput = {
  proofSystem?: string;
  framework?: string;
  recordType?: string;

  proof?: unknown;

  // ⬇️ lazítunk: a CLI-ból jöhet string/array/akármi → adapterekben refine
  publicInputs?: unknown;
  publicSignals?: unknown;

  verificationKey?: unknown;
  vkey?: unknown;

  meta?: {
    proofSystem?: string;
    framework?: string;
    [k: string]: unknown;
  };
} & Record<string, unknown>;

export interface Adapter {
  id: string; // e.g. "snarkjs-groth16"
  proofSystem: 'groth16' | 'plonk';
  framework: 'snarkjs' | 'zokrates';

  canHandle(input: DetectInput): boolean;
  verify(
    input: DetectInput,
  ): Promise<{ ok: true; adapter: string } | { ok: false; adapter: string; error: string }>;
}
