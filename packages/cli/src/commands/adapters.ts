// packages/cli/src/commands/adapters.ts
import type { CommandModule } from 'yargs';
import { getAllAdapters } from '../registry/adapterRegistry.js';
import { writeJsonStdout, writeJsonStderr } from '../utils/ioJson.js';
import { computeUseExit } from '../utils/argvFlags.js';

// ---- command ------------------------------------------------------------

type Row = { readonly id: string; readonly proofSystem: string; readonly framework: string };

export const adaptersCmd: CommandModule<object, { json?: boolean } & Record<string, unknown>> = {
  command: 'adapters',
  describe: 'List available adapters',
  builder: (yy) =>
    yy
      .option('json', { type: 'boolean', default: false, describe: 'Print JSON array to STDOUT' })
      .option('use-exit-codes', { type: 'boolean', default: false, hidden: true })
      .option('exit-codes', { type: 'boolean', default: false, hidden: true })
      .option('useExitCodes', { type: 'boolean', default: false, hidden: true })
      .option('exitCodes', { type: 'boolean', default: false, hidden: true }),
  handler: async (argv) => {
    try {
      const adapters = await getAllAdapters();
      const rows: Row[] = adapters.map((a) => ({
        id: a.id,
        proofSystem: a.proofSystem ?? 'unknown',
        framework: a.framework ?? 'unknown',
      }));
      if (argv.json) writeJsonStdout(rows);
      else console.log(JSON.stringify(rows));
    } catch (err) {
      const out = {
        ok: false as const,
        stage: 'cli' as const,
        error: 'adapter_error' as const,
        message: (err as Error).message,
      };
      if (argv.json) writeJsonStderr(out);
      else console.error('ERROR:', out.message);
      if (computeUseExit(argv)) process.exitCode = 1;
    }
  },
};
