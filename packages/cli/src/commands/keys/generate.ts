import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { defaultStoreRoot, saveKeypairForKeyId } from '../../utils/keystore.js';

interface Args {
  alg: 'ed25519';
  keyId: string;
  store?: string;
  overwrite?: boolean;
  json?: boolean;
}

export const keysGenerateCmd: CommandModule<unknown, Args> = {
  command: 'generate',
  describe: 'Generate a new keypair into the keystore (dev-only)',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('alg', { type: 'string', choices: ['ed25519'], default: 'ed25519', desc: 'Algorithm' })
        .option('keyId', { type: 'string', demandOption: true, desc: 'Logical key identifier to embed' })
        .option('store', { type: 'string', default: defaultStoreRoot(), desc: 'Keystore root directory' })
        .option('overwrite', { type: 'boolean', default: false, desc: 'Overwrite if key already exists' })
        .option('json', { type: 'boolean', default: false, desc: 'JSON output' })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv: ArgumentsCamelCase<Args>) => {
    try {
      if (argv.alg !== 'ed25519') throw new Error('Only ed25519 is supported in this version.');
      const store: string | undefined = typeof argv.store === 'string' ? argv.store : undefined;
      const rec = saveKeypairForKeyId(argv.keyId, store, argv.overwrite === true);
      if (argv.json) {
        process.stdout.write(JSON.stringify({
          ok: true,
          keyId: argv.keyId,
          privatePemPath: rec.privatePemPath,
          publicPemPath: rec.publicPemPath,
          store: store ?? defaultStoreRoot(),
        }) + '\n');
      } else {
        // eslint-disable-next-line no-console
        console.log(`✅ Generated ed25519 key: keyId=${argv.keyId}
  private: ${rec.privatePemPath}
   public: ${rec.publicPemPath}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Key generation failed';
      if (argv.json) process.stderr.write(JSON.stringify({ ok: false, message: msg }) + '\n');
      else console.error(`❌ ${msg}`);
      process.exitCode = 1;
    }
  },
};
