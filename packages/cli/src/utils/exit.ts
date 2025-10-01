// packages/cli/src/utils/exit.ts
// English comments, strict TS, no `any`.
// Centralized, typed exit handling for CLI commands.

import type { VerifySealResult } from '@zkpip/core';

/** Conventional exit codes across our CLI. */
export enum ExitCode {
  OK = 0,
  UNEXPECTED = 1,
  IO_ERROR = 2,
  SCHEMA_INVALID = 3,
  VERIFY_ERROR = 4,
  INVALID_ARGS = 5
}

/** Map a VerifySealResult to an exit code. */
export function exitCodeFromVerify(res: VerifySealResult): ExitCode {
  if (res.ok) return ExitCode.OK;
  switch (res.code) {
    case 2: return ExitCode.IO_ERROR;       // e.g., PUBLIC_KEY_NOT_FOUND
    case 3: return ExitCode.SCHEMA_INVALID; // e.g., SIGNATURE_BASE64_ERROR
    case 4: return ExitCode.VERIFY_ERROR;   // e.g., URN_MISMATCH, SIGNATURE_INVALID
    case 5: return ExitCode.INVALID_ARGS;   // e.g., INVALID_ARGS
    default: return ExitCode.UNEXPECTED;
  }
}

/**
 * Perform process exit with hard/soft mode:
 * - Hard: process.exit(code)    when ZKPIP_HARD_EXIT === '1'
 * - Soft: set process.exitCode and throw to abort the command gracefully
 */
export function doExit(code: ExitCode, note?: string): never {
  const hard = process.env.ZKPIP_HARD_EXIT === '1';
  if (hard) {
    // Hard exit: immediately terminate with the exact code.
    // Avoid throwing to keep stack traces out of stdout/stderr unless desired.
    process.exit(code);
  }
  // Soft exit: let tests & runners catch the error, but set the intended exit code.
  process.exitCode = code;
  const msg = note ? `Aborted (${ExitCode[code]}=${code}): ${note}` : `Aborted (${ExitCode[code]}=${code})`;
  throw new Error(msg);
}

/** Convenience: exit directly from a VerifySealResult. */
export function exitFromVerify(res: VerifySealResult): never {
  return doExit(exitCodeFromVerify(res));
}
