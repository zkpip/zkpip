#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * NodeNext ESM + yargs entrypoint.
 * - Lazy-loads the heavy verify command
 * - Provides real aliases (--bundle -> --verification, --exit-codes <-> --use-exit-codes)
 * - Normalizes flags and avoids passing undefined (exactOptionalPropertyTypes friendly)
 */

import yargs, { type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { adaptersCmd } from './commands/adapters.js';

// Types for the verify handler args (keep in sync with commands/verify.ts)
type VerifyHandlerArgs = {
  adapter?: string;
  verification?: string;
  json?: boolean;
  useExitCodes?: boolean;
  noSchema?: boolean;
};

const verifyLazyCmd: CommandModule = {
  command: 'verify',
  describe: 'Verify a proof bundle or a verification JSON input',
  builder: (yy) =>
    yy
      // Real alias: --bundle maps to --verification
      .option('verification', {
        type: 'string',
        alias: ['bundle'],
        describe:
          'Verification input: directory (triplet), JSON file path, or inline JSON. Alias: --bundle',
      })
      .option('adapter', {
        type: 'string',
        describe: 'Adapter id (e.g. snarkjs-groth16, snarkjs-plonk). If omitted, the tool may try to guess.',
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
      // Treat both flags as the same; yargs merges them on the same boolean value.
      .option('use-exit-codes', {
        type: 'boolean',
        alias: ['exit-codes'],
        default: false,
        describe: 'Non-zero exit codes on failure (1=verify failed, 2=adapter/IO error, 3=schema invalid)',
      })
      // yargs automatically supports --no-schema for this boolean
      .option('schema', {
        type: 'boolean',
        default: true,
        describe: 'Enable MVS schema validation (use --no-schema to skip)',
      })
      // Extra convenience aliases that users might pass; we’ll normalize in handler.
      .option('no-schema', {
        type: 'boolean',
        default: false,
        describe: 'Alias of --schema=false',
      })
      .option('skip-schema', {
        type: 'boolean',
        default: false,
        describe: 'Alias of --no-schema',
      })
      .parserConfiguration({ 'camel-case-expansion': true })
      .strictOptions()
      .check((argv) => {
        if (argv['list-adapters']) return true;
        if (!argv.verification) {
          throw new Error('Provide --bundle or --verification');
        }
        return true;
      }),
  handler: async (argv) => {
    // If user only wants to list adapters, delegate to adapters command and exit
    if (argv['list-adapters']) {
      // Run the adapters command's handler directly
      await (adaptersCmd.handler as (a: unknown) => Promise<void> | void)({
        json: argv.json,
      });
      return;
    }

    // Lazy-load the real verify command to avoid pulling heavy deps on startup
    const mod = (await import('./commands/verify.js')) as {
      handler: (a: VerifyHandlerArgs) => Promise<void> | void;
    };

    // Build args WITHOUT undefined properties (exactOptionalPropertyTypes)
    const args: VerifyHandlerArgs = {
      json: !!argv.json,
      useExitCodes: !!argv['use-exit-codes'], // alias already maps here
      // noSchema is true if:
      //   - schema === false OR user passed --no-schema OR --skip-schema
      noSchema: argv.schema === false || !!argv['no-schema'] || !!argv['skip-schema'],
      ...(typeof argv.adapter === 'string' && argv.adapter ? { adapter: argv.adapter } : {}),
      ...(typeof argv.verification === 'string' && argv.verification
        ? { verification: argv.verification }
        : {}),
    };

    await mod.handler(args);
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
