// packages/cli/src/commands/vectors-pull.ts
// ESM, strict TS. Minimal "pull by URL or fileUrl from catalog" MVP.
import { runVectorsPull } from '../utils/runVectorsPull.js'
import type { Argv, CommandModule } from 'yargs';

export interface VectorsPullArgs {
  id?: string;          // e.g. urn:zkpip:vector:sha256:<HEX>  (future use with registry)
  url?: string;         // direct URL to proof-envelope.json (POC)
  out: string;          // output path
}

export const vectorsPullCmd: CommandModule<unknown, VectorsPullArgs> = {
  command: 'vectors pull',
  describe: 'Download a canonical vector (ProofEnvelope) by id or URL',
  builder: (yy: Argv<unknown>): Argv<VectorsPullArgs> => {
    const built = yy
      .option('id',  { type: 'string', describe: 'VectorId (urn:zkpip:vector:sha256:...)' })
      .option('url', { type: 'string', describe: 'Direct file URL to proof-envelope.json' })
      .option('out', { type: 'string', demandOption: true, describe: 'Output file path' })
      .check((argv) => {
        if (!argv.id && !argv.url) throw new Error('Either --id or --url is required');
        return true;
      });
    return built as unknown as Argv<VectorsPullArgs>;
  },
  handler: async (args) => {
    const code = await runVectorsPull(args);
    process.exitCode = code;
  },
};
export default vectorsPullCmd;
