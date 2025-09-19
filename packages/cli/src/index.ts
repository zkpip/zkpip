#!/usr/bin/env node
/* Minimal yargs-free dispatcher + local yargs subtree for "manifest".
   Commands:
     zkpip verify --verification <path>|- [--adapter <id>] [--dump-envelope] [--use-exit-codes]
     zkpip manifest <sign|verify> [...]
*/

import { runVerifyCli } from './verify-cli.js';
import { runManifestCli } from './manifest-cli.js';
import { runKeysCli } from './keys-cli.js';

function printHelp(): void {
  console.log(`Usage:
  zkpip verify --verification <path>|- [--adapter <id>] [--dump-envelope] [--use-exit-codes]
  zkpip manifest <sign|verify> [options]
`);
}

(async () => {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    process.exitCode = 0;
    return;
  }

  if (cmd === 'verify') {
    await runVerifyCli(argv.slice(1));
    return;
  }

  if (cmd === 'manifest') {
    await runManifestCli(argv.slice(1)); // delegate to yargs subtree
    return;
  }

  if (cmd === 'keys') {
    await runKeysCli(argv.slice(1));
    return;
  }  

  // Unknown command → JSON error and exit 1
  console.error(
    JSON.stringify({
      ok: false,
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command: ${cmd}`,
    }),
  );
  process.exitCode = 1;
})();
