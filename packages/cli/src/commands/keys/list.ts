import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { defaultStoreRoot, listKeys } from '../../utils/keystore.js';

interface Args {
  store?: string;
  json?: boolean;
}

export const keysListCmd: CommandModule<unknown, Args> = {
  command: 'list',
  describe: 'List keys in the keystore',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('store', { type: 'string', default: defaultStoreRoot(), desc: 'Keystore root directory' })
        .option('json', { type: 'boolean', default: false, desc: 'JSON output' })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv: ArgumentsCamelCase<Args>) => {
    try {
      const store: string | undefined = typeof argv.store === 'string' ? argv.store : undefined;
      const rows = listKeys(store);
      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: true, count: rows.length, items: rows }, null, 2) + '\n');
      } else {
        if (rows.length === 0) {
          console.log('No keys found.');
          return;
        }
        for (const r of rows) {
          console.log(`- ${r.dir}
    private: ${r.privatePemPath}
     public: ${r.publicPemPath}
     created: ${r.createdAt?.toISOString() ?? '(unknown)'}
`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'List failed';
      if (argv.json) process.stderr.write(JSON.stringify({ ok: false, message: msg }) + '\n');
      else console.error(`❌ ${msg}`);
      process.exitCode = 1;
    }
  },
};
