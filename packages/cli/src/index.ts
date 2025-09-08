#!/usr/bin/env node
/* eslint-disable no-console */
// NodeNext ESM + yargs. Keep verify lazy; adapters parancs regisztrálva.

import yargs, { type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { adaptersCmd } from './commands/adapters.js';

// Minimal, duplicate builder for verify flags (so strict() nem akad fenn),
// a valódi logikát a ./commands/verify.js handler futtatja.
const verifyLazyCmd: CommandModule = {
  command: 'verify',
  describe: 'Verify a proof bundle or a verification JSON input',
  builder: (yy) =>
    yy
      .option('bundle', {
        type: 'string',
        describe: 'Path to a proof-bundle JSON file',
      })
      .option('verification', {
        type: 'string',
        describe: 'Path to a verification JSON file (can reference a bundle path)',
      })
      .option('adapter', {
        type: 'string',
        describe: 'Adapter id (e.g. snarkjs-groth16). If omitted, we try to guess.',
      })
      .option('list-adapters', {
        type: 'boolean',
        default: false,
        describe: 'List available adapters and exit',
      })
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Emit machine-readable JSON output',
      })
      .option('exit-codes', {
        type: 'boolean',
        default: false,
        describe:
          'Non-zero exit codes on failure (1=verify failed, 2=adapter not found/unsupported, 3=schema invalid, 4=I/O error)',
      })
      .option('use-exit-codes', {
        type: 'boolean',
        default: false,
        describe: 'Alias for --exit-codes',
      })
      .option('debug', {
        type: 'boolean',
        default: false,
        describe: 'Verbose error output on failures',
      })
      .parserConfiguration({ 'camel-case-expansion': true })
      .check((argv) => {
        if (argv['list-adapters']) return true;
        if (!argv.bundle && !argv.verification) {
          throw new Error('Provide --bundle or --verification');
        }
        return true;
      }),
  handler: async (argv) => {
    // Lazy-load the real command to avoid pulling heavy deps on startup
    const mod = (await import('./commands/verify.js')) as {
      handler: (a: unknown) => Promise<void> | void;
    };
    await mod.handler(argv);
  },
};

(async () => {
  await yargs(hideBin(process.argv))
    .scriptName('zkpip')
    .command(verifyLazyCmd)
    .command(adaptersCmd)
    .demandCommand(1)
    .strict()
    .help()
    .parse();
})();
