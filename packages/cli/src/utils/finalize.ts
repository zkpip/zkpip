// packages/cli/src/utils/finalize.ts
import { ExitCode } from './exit.js';

/** Hard-exit, fallback UNEXPECTED. */
export function finalizeExit(code?: number): never {
  const final: number =
    typeof code === 'number' ? code :
    typeof process.exitCode === 'number' ? process.exitCode :
    ExitCode.UNEXPECTED;
  process.exit(final);
}