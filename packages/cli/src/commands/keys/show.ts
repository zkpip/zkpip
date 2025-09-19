import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { defaultStoreRoot, pathsForKeyId, readPublicPemForKeyId } from '../../utils/keystore.js';

interface Args {
  keyId: string;
  store?: string;
  json?: boolean;
}

export const keysShowCmd: CommandModule<unknown, Args> = {
  command: 'show',
  describe: 'Show public key PEM for a given keyId',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('keyId', { type: 'string', demandOption: true, desc: 'Logical key identifier' })
        .option('store', { type: 'string', default: defaultStoreRoot(), desc: 'Keystore root directory' })
        .option('json', { type: 'boolean', default: false, desc: 'JSON output' })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv: ArgumentsCamelCase<Args>) => {
    try {
      const store: string | undefined = typeof argv.store === 'string' ? argv.store : undefined;
      const pem = readPublicPemForKeyId(argv.keyId, store);
      const rec = pathsForKeyId(argv.keyId, store);
      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: true, keyId: argv.keyId, publicPemPath: rec.publicPemPath, publicPem: pem }) + '\n');
      } else {
        console.log(pem);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Show failed';
      if (argv.json) process.stderr.write(JSON.stringify({ ok: false, message: msg }) + '\n');
      else console.error(`❌ ${msg}`);
      process.exitCode = 1;
    }
  },
};
