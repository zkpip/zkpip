#!/usr/bin/env node
/* Minimal yargs-free dispatcher.
   Commands:
     zkpip verify --verification <path>|- [--adapter <id>] [--dump-envelope] [--use-exit-codes]
*/

import { runVerifyCli } from './verify-cli.js';

function printHelp(): void {
  console.log(`Usage:
  zkpip verify --verification <path>|- [--adapter <id>] [--dump-envelope] [--use-exit-codes]
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

  // Unknown command → JSON hiba és exit 1
  console.error(
    JSON.stringify({
      ok: false,
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command: ${cmd}`,
    }),
  );
  process.exitCode = 1;
})();
