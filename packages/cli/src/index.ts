#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { buildVectorsValidateCommand } from './commands/vectors-validate.js';
import { verifyCmd } from './commands/verify.js';
import { validatePath } from './commands/validate.js';

yargs(hideBin(process.argv))
  .scriptName('zkpip')
  .command(buildVectorsValidateCommand())
  .command(verifyCmd)
  .command(
    ['validate <file>', 'schema:validate <file>'],
    'Validate a single JSON file against a schema picked from its filename',
    (yy) =>
      yy
        .positional('file', {
          type: 'string',
          describe: 'Path to the JSON file to validate',
          demandOption: true,
        })
        .option('schemas-root', {
          type: 'string',
          describe: 'Path to schemas root (e.g. ./packages/core/schemas)',
        })
        .option('schemasRoot', {
          type: 'string',
          hidden: true, // camelCase alias
        })
        .parserConfiguration({ 'camel-case-expansion': true }),
    async (argv) => {
      await validatePath(argv.file as string);
      console.log('✅ Validation OK');
    },
  )
  .demandCommand()
  .strict()
  .help()
  .locale('en')
  .parse();
