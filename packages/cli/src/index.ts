/* Minimal yargs-free dispatcher + local yargs subtree for "manifest".
   Commands:
     zkpip verify   …
     zkpip manifest …
     zkpip keys     …
     zkpip forge    …
     zkpip vectors  …
*/

import { composeHelp, topLevelUsage } from './help.js';
import { classifyExitCode, getErrorMessage } from './utils/error.js';
import { ExitCode } from './utils/exit.js';
export { type AdapterId } from './registry/adapterRegistry.js';
import { finalizeExit } from './utils/finalize.js';

type Runner = (args: readonly string[]) => Promise<void> | void;

function printHelp(): void {
  console.log(composeHelp(topLevelUsage()));
}

function normalizeForHelp(args: readonly string[]): readonly string[] {
  // távolítsuk el a 'help' tokent, és tegyük be a --help-et elejére
  const rest = args.filter(a => a !== 'help');
  return ['--help', ...rest];
}

const factories: Record<string, () => Promise<Runner>> = {
  verify:   () => import('./verify-cli.js').then(m => m.runVerifyCli),
  manifest: () => import('./manifest-cli.js').then(m => m.runManifestCli),
  keys:     () => import('./keys-cli.js').then(m => m.runKeysCli),
  forge:    () =>
    import('./forge-cli.js').then(m => {
      return async (args: readonly string[]) => {
        const code = await m.runForgeCli(args);  
        process.exitCode = code;                 
      };
    }),
  vectors:  () =>
    import('./vectors-cli.js').then(m => {
      return async (args: readonly string[]) => {
        const code = await m.runVectorsCli(args); // Promise<ExitCode>
        process.exitCode = code;
      };
    }),
};

function hasFlag(argv: readonly string[], ...flags: readonly string[]): boolean {
  return argv.some(a => flags.includes(a));
}

(async () => {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  // No subcommand: show global help and exit 0
  if (!cmd) {
    printHelp();
    return finalizeExit(ExitCode.OK);
  }

  // Explicit global help
  if (cmd === 'help' || hasFlag(argv, '--help', '-h')) {
    const sub = argv[1];
    if (cmd === 'help' && sub && factories[sub]) {
      const run = await factories[sub]();
      await run(normalizeForHelp(argv.slice(2)));
      return finalizeExit(ExitCode.OK);
    }
    printHelp();
    return finalizeExit(ExitCode.OK);
  }

  // Known subcommand? Always delegate; do NOT print usage here.
  const factory = factories[cmd];
  if (factory) {
    try {
      const run = await factory();

      // Only treat as "help" if flags explicitly request help
      const askHelp = hasFlag(rest, '--help', '-h');
      const args = askHelp ? normalizeForHelp(rest) : rest;

      await run(args);

      // If handler didn't set an exit code or exit, default to success
      if (process.exitCode == null) {
        process.exitCode = ExitCode.OK;
      }
    } catch (err) {
      // Log a meaningful message, but don't hard-exit here
      const note = getErrorMessage(err);
      if (note) process.stderr.write(note + '\n');

      // If no exitCode was set yet (or was incorrectly left at OK), classify
      if (process.exitCode == null || process.exitCode === ExitCode.OK) {
        process.exitCode = classifyExitCode(err); // IO / SCHEMA / UNEXPECTED
      }
    }

    return finalizeExit();
  }

  // Unknown command → INVALID_ARGS (user error)
  process.stderr.write(
    JSON.stringify({
      ok: false,
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command: ${cmd}`,
    }) + '\n'
  );
  return finalizeExit(ExitCode.INVALID_ARGS);
})();
