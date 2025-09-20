import type { VerifyHandlerArgs } from '../types/cli.js';

// Safe getter for unknown-shaped argv
function getProp(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

// Accept all common spellings and truthy forms for --use-exit-codes
// utils/argvFlags.ts
export function computeUseExit(argv: unknown): boolean {
  const truthy = (x: unknown): boolean => {
    if (x === true || x === 1 || x === '') return true;
    if (typeof x === 'string') {
      const s = x.trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    }
    return false;
  };

  const flag =
    truthy(getProp(argv, 'use-exit-codes')) ||
    truthy(getProp(argv, 'exit-codes')) ||
    truthy(getProp(argv, 'useExitCodes')) ||
    truthy(getProp(argv, 'exitCodes'));

  // ENV override (handy for CI/tests)
  const env =
    truthy(process.env.ZKPIP_USE_EXIT_CODES) ||
    truthy(process.env.CI_USE_EXIT_CODES);

  return flag || env;
}

export function getVerificationRaw(opts: VerifyHandlerArgs): string {
  // Accept both --verification and legacy --envelope
  return String(opts.verification ?? opts.bundle ?? '');
}
