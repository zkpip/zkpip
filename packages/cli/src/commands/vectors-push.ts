import type { CommandModule } from 'yargs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DiskProvider } from '../providers/s3.js';
import { DiskStore } from '../utils/vectorStore.js';

export type VectorsPushOptions = Readonly<{
  id: string;      // canonical URN
  inPath: string;  // vector or sealed content
  baseDir: string; // local disk bucket
}>;

type PushArgs = { id: string; in: string; outDir?: string };

export async function vectorsPush(opts: VectorsPushOptions): Promise<void> {
  const store = new DiskStore(opts.baseDir);
  const content = await readFile(opts.inPath, 'utf8');
  await store.putVector(opts.id, content, 'application/json');
}

export const vectorsPushCmd: CommandModule<unknown, PushArgs> = {
  command: 'vectors push',
  describe: 'Push vector to backend (dev: disk; prod: S3)',
  builder: (y) =>
    y.option('id', { type: 'string', demandOption: true })
      .option('in', { type: 'string', demandOption: true })
      .option('out-dir', { type: 'string', default: '.zkpip/vectors' }),
  handler: async (argv) => {
    const body = await readFile(resolve(argv.in), 'utf8');
    const provider = new DiskProvider(resolve(argv.outDir!));
    await provider.putVector(argv.id, body, 'application/json');
    process.stdout.write(`stored:${argv.id}\n`);
  },
};
