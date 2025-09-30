// ESM, strict TS, no "any".
// Local yargs subtree for `zkpip manifest ...`

import yargs, { type Argv } from 'yargs';
import { manifestSignCmd } from './commands/manifest/sign.js';
import { manifestVerifyCmd } from './commands/manifest/verify.js';

export async function runManifestCli(args: readonly string[]): Promise<void> {
  const a: string[] = Array.from(args);

  await (yargs(a) as Argv<unknown>)
    .parserConfiguration({ 'camel-case-expansion': true })
    .scriptName('zkpip manifest')
    .strict()
    .strictCommands()
    .command(manifestSignCmd)
    .command(manifestVerifyCmd)
    .demandCommand(1)
    .help()
    .parse();
}
