// zkpip manifest verify --in <file> --pub <pem>
// ESM-only, strict TS. No "any".

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandModule, Argv } from 'yargs';
import { verifyManifest } from '@zkpip/core';
import type { ZkpipManifest } from '@zkpip/core';

interface Args {
  in: string;
  pub: string;
  json?: boolean;
  useExitCodes?: boolean; // <-- camelCase in types
}

export const manifestVerifyCmd: CommandModule<unknown, Args> = {
  command: 'verify',
  describe: 'Verify a signed manifest (M1/A)',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('in',  { type: 'string', demandOption: true, desc: 'Signed manifest JSON path' })
        .option('pub', { type: 'string', demandOption: true, desc: 'Public key PEM (SPKI) path' })
        .option('json', { type: 'boolean', default: false, desc: 'JSON structured CLI output' })
        .option('useExitCodes', { type: 'boolean', default: false, desc: 'Return 0/1 based on result' })
        .alias('useExitCodes', 'use-exit-codes')
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv) => {
    const inPath = resolve(argv.in);
    const pubPem = readFileSync(resolve(argv.pub), 'utf8');
    const manifest = JSON.parse(readFileSync(inPath, 'utf8')) as ZkpipManifest;

    const res = verifyManifest({ manifest, publicKeyPem: pubPem });

    if (argv.json) {
      process.stdout.write(JSON.stringify({ ok: res.ok, reason: res.reason ?? null }) + '\n');
    } else {
      // eslint-disable-next-line no-console
      console.log(res.ok ? '✅ Manifest verification OK' : `❌ Manifest verification FAILED: ${res.reason}`);
    }
    if (argv.useExitCodes) process.exit(res.ok ? 0 : 1);
  },
};
