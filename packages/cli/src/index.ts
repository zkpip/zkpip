/* Minimal yargs-free dispatcher + local yargs subtree for "manifest".
   Commands:
     zkpip verify   …
     zkpip manifest …
     zkpip keys     …
     zkpip forge    …
     zkpip vectors  …
*/

import { composeHelp, topLevelUsage } from './help.js';
export { type AdapterId } from './registry/adapterRegistry.js';

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
  forge:    () => import('./forge-cli.js').then(m => m.runForgeCli),
  vectors:  () => import('./vectors-cli.js').then(m => m.runVectorsCli),
};

function hasFlag(argv: readonly string[], ...flags: readonly string[]): boolean {
  return argv.some(a => flags.includes(a));
}

function hasInFlag(argv: readonly string[]): boolean {
  return argv.some(a => a === '--in' || a.startsWith('--in=') || a === '--inDir' || a.startsWith('--inDir='));
}

function hasDryRunFlag(argv: readonly string[]): boolean {
  return argv.includes('--dry-run');
}

(async () => {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  // No subcommand: show global help and exit 0
  if (!cmd) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  // Explicit global help
  if (cmd === 'help' || hasFlag(argv, '--help', '-h')) {
    const sub = argv[1];
    if (cmd === 'help' && sub && factories[sub]) {
      const run = await factories[sub]();
      await run(normalizeForHelp(argv.slice(2)));
      process.exitCode = 0;
      return;
    }
    printHelp();
    process.exitCode = 0;
    return;
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

      // If handler didn't set an exit code or exit, default to 0 (success)
      if (typeof process.exitCode !== 'number') process.exitCode = 0;
    } catch (err) {
      // Standardize non-zero exit on errors
      if (typeof process.exitCode !== 'number' || process.exitCode === 0) {
        process.exitCode = 1;
      }

      // Special case: forge without --in/--dry-run → emit FORGE_ERROR if the handler didn't
      if (
        cmd === 'forge' &&
        !hasInFlag(rest) &&
        !hasDryRunFlag(rest)
      ) {
        const message =
          err instanceof Error ? err.message : String(err ?? 'Missing --in option');
        // Write a single-line JSON to stderr (what the test expects)
        process.stderr.write(
          JSON.stringify({ ok: false, code: 'FORGE_ERROR', message }) + '\n'
        );
      }
    }

    if (process.env.ZKPIP_HARD_EXIT === '1') process.exit(process.exitCode ?? 0);
    return;
  }

  // Unknown command
  process.stderr.write(
    JSON.stringify({
      ok: false,
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command: ${cmd}`,
    }) + '\n'
  );
  process.exitCode = 1;
})();
