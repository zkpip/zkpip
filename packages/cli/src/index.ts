#!/usr/bin/env node
/* Minimal yargs-free dispatcher + local yargs subtree for "manifest".
   Commands:
     zkpip verify --verification <path>|- [--adapter <id>] [--dump-envelope] [--use-exit-codes]
     zkpip manifest <sign|verify> [...]
*/
import { runVerifyCli } from './verify-cli.js';
import { runManifestCli } from './manifest-cli.js';
import { runKeysCli } from './keys-cli.js';
import { runForgeCli } from './forge-cli.js';
import { runVectorsCli } from './vectors-cli.js';
import { composeHelp, topLevelUsage } from './help.js';

export { type AdapterId } from './registry/adapterRegistry.js';

function printHelp(): void {
  console.log(composeHelp(topLevelUsage()));
}

(async () => {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  // global help
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    // Support: "zkpip help" and "zkpip help <cmd>"
    const sub = argv[1];
    if (!sub) {
      printHelp();
      process.exitCode = 0;
      return;
    }
    // Delegate to the subcommand with --help appended
    const rest = argv.slice(2);
    if (sub === 'verify') { await runVerifyCli(['--help', ...rest]); return; }
    if (sub === 'manifest') { await runManifestCli(['--help', ...rest]); return; }
    if (sub === 'keys') { await runKeysCli(['--help', ...rest]); return; }
    if (sub === 'forge') { await runForgeCli(['--help', ...rest]); return; }
    if (sub === 'vectors') { await runVectorsCli(['--help', ...rest]); return; }
    // Unknown sub in help → print top help
    printHelp();
    process.exitCode = 0;
    return;
  }

  if (cmd === 'verify') { await runVerifyCli(argv.slice(1)); return; }
  if (cmd === 'manifest') { await runManifestCli(argv.slice(1)); return; }
  if (cmd === 'keys') { await runKeysCli(argv.slice(1)); return; }
  if (cmd === 'forge') { await runForgeCli(argv.slice(1)); return; }
  if (cmd === 'vectors') { await runVectorsCli(argv.slice(1)); return; }

  // Unknown command → JSON error and exit 1
  console.error(JSON.stringify({ ok: false, code: 'UNKNOWN_COMMAND', message: `Unknown command: ${cmd}` }));
  process.exitCode = 1;
})();
