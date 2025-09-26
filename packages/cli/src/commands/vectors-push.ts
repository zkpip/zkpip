import type { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DiskStore } from '../utils/vectorStore.js';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

type PushArgs = {
  id: string;
  // primary (CI): --store + --data
  store?: string;
  data?: string;
  // legacy/alt aliases: --in + --out-dir
  in?: string;
  'out-dir'?: string;
};

export type VectorsPushOptions = Readonly<{
  id: string;
  baseDir: string;
  inPath?: string;
  data?: string;
  /** Only "application/json" supported by DiskStore.putVector */
  contentType?: 'application/json';
}>;

export async function vectorsPush(opts: VectorsPushOptions): Promise<void> {
  // Validate inputs
  if ((!opts.data && !opts.inPath) || !opts.id || !opts.baseDir) {
    throw new Error('MISSING_ARGS: need id, baseDir and either data or inPath');
  }

  const baseDir = resolve(opts.baseDir);
  // Ensure target directory exists before writing
  await mkdir(baseDir, { recursive: true });

  // Resolve body
  const content: string = typeof opts.data === 'string'
    ? opts.data
    : await readFile(resolve(opts.inPath!), 'utf8');

  const store = new DiskStore(baseDir);
  await store.putVector(opts.id, content, opts.contentType ?? 'application/json');
}

export const vectorsPushCmd: CommandModule<unknown, PushArgs> = {
  command: 'vectors push',
  describe: 'Push vector to backend (dev: disk; prod: S3)',
  builder: (y: Argv<unknown>) =>
    (y
      .option('id',      { type: 'string', demandOption: true })
      .option('store',   { type: 'string', desc: 'Output directory (disk store root)' })
      .option('data',    { type: 'string', desc: 'Inline JSON payload' })
      .option('in',      { type: 'string', desc: 'Read JSON from file (alias of --data)' })
      .option('out-dir', { type: 'string', desc: 'Alias of --store' })
      .strictOptions()
    ) as unknown as Argv<PushArgs>,
  handler: async (argv: ArgumentsCamelCase<PushArgs>) => {
    try {
      const root = resolve(argv.store ?? argv['out-dir'] ?? '.zkpip/vectors');
      await mkdir(root, { recursive: true }); // <-- mkdirp BEFORE write

      const body: string =
        typeof argv.data === 'string' ? argv.data :
        typeof argv.in   === 'string' ? await (await import('node:fs/promises')).readFile(resolve(argv.in), 'utf8') :
        '';

      if (!body) {
        console.error(JSON.stringify({ ok:false, code:'MISSING_ARGS', message:'Need --data or --in' }));
        process.exitCode = 1;
        return;
      }

      // Safe filename a CI teszt elvárása szerint
      const safe = argv.id.replace(/[^a-zA-Z0-9:._-]/g, '_');
      const out  = join(root, `${safe}.json`);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, body, 'utf8');

      process.stdout.write(`stored:${argv.id}\n`);
      process.exitCode = 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({ ok:false, code:'PUSH_FAILED', message: msg }));
      process.exitCode = 1;
    }
  },
};