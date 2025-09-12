// Map verify outcome → process exit code used by tests/CI.

type VerifyOk = { ok: true };
type VerifyErr = {
  ok: false;
  error:
    | 'verification_failed'
    | 'adapter_not_found'
    | 'schema_invalid'
    | 'io_error'
    | 'adapter_error';
  message?: string;
  stage?: 'io' | 'schema' | 'verify' | string;
};

export type VerifyOutcomeU = VerifyOk | VerifyErr;

export function mapVerifyOutcomeToExitCode(out: VerifyOutcomeU): number {
  if (out.ok) return 0;
  // Stage hints first (I/O: ENOENT, JSON.parse, etc.)
  if (out.stage === 'io' || /ENOENT|EACCES|JSON\.parse/i.test(out.message ?? '')) return 2;
  if (out.stage === 'schema') return 3;

  switch (out.error) {
    case 'verification_failed':
      return 1;
    case 'io_error':
      return 2;
    case 'schema_invalid':
      return 3;
    case 'adapter_not_found':
      return 4;
    default:
      return 1; // adapter_error → treat as verify fail
  }
}
