// Keep comments in English (OSS).

export type Framework = 'snarkjs' | 'zokrates';
export type ProofSystem = 'plonk' | 'groth16';
export type Validity = 'valid' | 'invalid';

// e.g. "can:snarkjs:plonk:add1:valid"
export type VectorId = `can:${Framework}:${ProofSystem}:${string}:${Validity}`;

export interface VectorManifestV1 {
  readonly version: 1;
  readonly id: VectorId;
  readonly framework: Framework;
  readonly proofSystem: ProofSystem;
  readonly urls: {
    readonly verification: string; // points to verification.json
    readonly vkey?: string;
    readonly proof?: string;
    readonly publics?: string;
  };
  readonly sha256?: Partial<Record<'verification' | 'vkey' | 'proof' | 'publics', string>>;
  readonly size?: Partial<Record<'verification' | 'vkey' | 'proof' | 'publics', number>>;
  readonly meta?: Readonly<Record<string, string | number | boolean>>;
}

export interface ResolvedVector {
  readonly id: VectorId;
  readonly verificationJson: unknown; // already parsed
  readonly manifest?: VectorManifestV1;
}

export interface VectorProvider {
  // Accepts either a ready manifest or a vector id string.
  resolve(input: VectorId | VectorManifestV1): Promise<ResolvedVector>;
}
