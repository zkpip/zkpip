// ESM + NodeNext, no "any", type-only module

export type BaseVerifyError = 'verification_failed' | 'adapter_error';

/**
 * Generic verify outcome. Adapterek a saját id-jükkel szűkíthetik:
 *   type X = VerifyOutcome<typeof id>;
 */
export type VerifyOutcome<A extends string = string> =
  | { ok: true;  adapter: A }
  | { ok: false; adapter: A; error: BaseVerifyError; message?: string };
