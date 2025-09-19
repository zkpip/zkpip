import { resolve } from 'node:path';
import type { CommandModule, Argv } from 'yargs';
import { verifyManifest } from '@zkpip/core';
import type { ZkpipManifest } from '@zkpip/core';
import { readUtf8Checked, resolvePath } from '../../utils/fs.js';

interface Args {
  in: string;
  pub: string;
  json?: boolean;
  useExitCodes?: boolean;
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
    const inPath = resolvePath(argv.in);
    const pubPath = resolvePath(argv.pub);

    try {
      const pubPem = readUtf8Checked(pubPath);
      const manifest = JSON.parse(readUtf8Checked(inPath)) as ZkpipManifest;

      const res = verifyManifest({ manifest, publicKeyPem: pubPem });

      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: res.ok, reason: res.reason ?? null }) + '\n');
      } else {
        // eslint-disable-next-line no-console
        console.log(res.ok ? '✅ Manifest verification OK' : `❌ Manifest verification FAILED: ${res.reason}`);
      }
      if (argv.useExitCodes) process.exit(res.ok ? 0 : 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error during manifest verification';
      const errorBody =
        err && typeof err === 'object' && 'code' in err
          ? { code: (err as { code: string }).code }
          : {};
      if (argv.json) {
        process.stderr.write(JSON.stringify({ ok: false, reason: 'io_error', message, ...errorBody }) + '\n');
      } else {
        // eslint-disable-next-line no-console
        console.error(`❌ ${message}`);
      }
      process.exitCode = 1;
      if (argv.useExitCodes) process.exit(1);
    }
  },
};
