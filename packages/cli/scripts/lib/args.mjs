// scripts/lib/args.mjs
import { CliError, ExitCode } from '../utils/exit-codes.mjs';

/** Strict: returns string or throws CliError */
export function requireArg(name, argv) {
  const i = argv.indexOf(name);
  const val = i >= 0 ? argv[i + 1] : undefined;
  if (!val) throw new CliError(ExitCode.INVALID_ARGS, `Missing required arg: ${name}`);
  return val;
}