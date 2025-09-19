// ESM, strict TS, no "any".
// Local yargs subtree for `zkpip manifest ...`

import yargs, { type Argv } from 'yargs';
import { manifestSignCmd } from './commands/manifest/sign.js';
import { manifestVerifyCmd } from './commands/manifest/verify.js';

export async function runManifestCli(args: string[]): Promise<void> {
  // Keep flags camelCase in types, but allow kebab-case in CLI (e.g., --key-id)
  const parserCfg: Record<string, boolean> = { 'camel-case-expansion': true };

  await (yargs(args) as Argv<unknown>)
    .parserConfiguration(parserCfg)
    .scriptName('zkpip manifest')
    .strict()
    .command(manifestSignCmd)
    .command(manifestVerifyCmd)
    .demandCommand(1)
    .help()
    .parse(); // note: args already sliced by index.ts
}
