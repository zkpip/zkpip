import yargs, { type Argv } from 'yargs';

import { keysGenerateCmd } from './commands/keys/generate.js';
import { keysListCmd } from './commands/keys/list.js';
import { keysShowCmd } from './commands/keys/show.js';

export async function runKeysCli(args: string[]): Promise<void> {
  await (yargs(args) as Argv<unknown>)
    .parserConfiguration({ 'camel-case-expansion': true })
    .scriptName('zkpip keys')
    .strict()
    .strictCommands()
    .command(keysGenerateCmd)
    .command(keysListCmd)
    .command(keysShowCmd)
    .demandCommand(1)
    .help()
    .parse();
}
