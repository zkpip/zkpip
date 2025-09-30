// English comments, strict TS, no `any`.

export type VerifyReason =
  | 'OK'
  | 'SIGNATURE_INVALID'
  | 'PUBLIC_KEY_NOT_FOUND'
  | 'SCHEMA_INVALID'
  | 'URN_MISMATCH'
  | 'ALGO_UNSUPPORTED'
  | 'SIGNATURE_BASE64_ERROR';

export const VerifyCode: Readonly<Record<VerifyReason, number>> = {
  OK: 0,
  SIGNATURE_INVALID: 1,
  PUBLIC_KEY_NOT_FOUND: 2,
  SCHEMA_INVALID: 3,
  URN_MISMATCH: 4,
  ALGO_UNSUPPORTED: 5,
  SIGNATURE_BASE64_ERROR: 6,
} as const;

export type VerifyResult = Readonly<{
  ok: boolean;
  code: number;
  reason: VerifyReason;
  message: string;
}>;
