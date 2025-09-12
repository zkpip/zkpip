import type { VerifyHandlerArgs } from '../types/cli.js';

// Safe getter for unknown-shaped argv
function getProp(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

// Accept all common spellings and truthy forms for --use-exit-codes
export function computeUseExit(argv: unknown): boolean {
  const truthy = (x: unknown): boolean => x === true || x === '' || x === 'true' || x === 1;

  return (
    truthy(getProp(argv, 'use-exit-codes')) ||
    truthy(getProp(argv, 'exit-codes')) ||
    truthy(getProp(argv, 'useExitCodes')) ||
    truthy(getProp(argv, 'exitCodes'))
  );
}

export function getVerificationRaw(opts: VerifyHandlerArgs): string {
  // Accept both --verification and legacy --bundle
  return String(opts.verification ?? opts.bundle ?? '');
}
