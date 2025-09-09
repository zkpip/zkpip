// packages/cli/src/adapters/types.ts

export type VerifyErrorCode = 'verification_failed' | 'adapter_error';

export type VerifyOutcome<TAdapterId extends string = string> =
  | { ok: true; adapter: TAdapterId }
  | { ok: false; adapter: TAdapterId; error: VerifyErrorCode; message?: string };

export interface Adapter<TAdapterId extends string = string> {
  id: TAdapterId;
  proofSystem?: string;
  framework?: string;
  canHandle(input: unknown): boolean;
  verify(input: unknown): Promise<VerifyOutcome<TAdapterId>>;
}
