// packages/cli/src/types/adapter.ts
export type VerificationOutcome = "valid" | "invalid" | "error";

export interface VerificationInput {
  proofBundle: unknown;      // JSON parsed bundle
  options?: Record<string, unknown>; // adapter-specific opts (e.g., fast mode)
}

export interface VerificationResult {
  outcome: VerificationOutcome;
  adapter: string;           // e.g., "snarkjs-groth16"
  checks: Array<{
    name: string;            // e.g., "groth16.verify"
    passed: boolean;
    details?: Record<string, unknown>;
  }>;
  error?: {
    code: string;
    message: string;
    cause?: unknown;
  };
}

export interface Adapter {
  readonly name: string;
  canHandle(bundle: unknown): boolean; // quick discriminator
  verify(input: VerificationInput): Promise<VerificationResult>;
}
