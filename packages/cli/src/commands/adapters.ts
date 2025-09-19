// packages/cli/src/commands/adapters.ts
import { getAllAdapters } from '../registry/adapterRegistry.js';
import { writeJsonStdout, writeJsonStderr } from '../utils/ioJson.js';

type Row = { readonly id: string; readonly proofSystem: string; readonly framework: string };

type ParsedFlags = {
  json: boolean;
  useExitCodes: boolean;
};

function parseFlags(argv: readonly string[]): ParsedFlags {
  let json = false;
  let useExitCodes = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';

    if (a === '--json' || a === '-j' || a.startsWith('--json=')) json = true;

    if (
      a === '--use-exit-codes' ||
      a === '--exit-codes' ||
      a === '--useExitCodes' ||
      a === '--exitCodes'
    ) {
      useExitCodes = true;
    }
  }

  return { json, useExitCodes };
}

/** Core implementáció – kilistázza az adaptereket és kiírja JSON-ként (vagy raw JSON stringként). */
async function listAdaptersAndPrint(json: boolean): Promise<void> {
  const adapters = await getAllAdapters();
  const rows: Row[] = adapters.map((a) => ({
    id: a.id,
    proofSystem: a.proofSystem ?? 'unknown',
    framework: a.framework ?? 'unknown',
  }));
  if (json) writeJsonStdout(rows);
  else console.log(JSON.stringify(rows));
}

/** Közvetlen CLI futtató ehhez a parancshoz. */
export async function runAdaptersCli(argv: readonly string[]): Promise<void> {
  const flags = parseFlags(argv);
  try {
    await listAdaptersAndPrint(flags.json);
    if (flags.useExitCodes && typeof process.exitCode !== 'number') process.exitCode = 0;
  } catch (err) {
    const out = {
      ok: false as const,
      stage: 'cli' as const,
      error: 'adapter_error' as const,
      message: (err as Error).message,
    };
    if (flags.json) writeJsonStderr(out);
    else console.error('ERROR:', out.message);
    if (flags.useExitCodes) process.exitCode = 1;
  }
}

/** Visszafelé kompatibilis export: csak a handler, yargs nélkül. */
export const adaptersCmd = {
  // yargs nélkül is hívható: adaptersCmd.handler({ json: true })
  async handler(argv: { json?: boolean; [k: string]: unknown }): Promise<void> {
    try {
      await listAdaptersAndPrint(argv.json === true);
      // Ha valaki --use-exit-codes-t adott át "argv"-ban, tartsuk tiszteletben:
      const useExit =
        argv['use-exit-codes'] === true ||
        argv['exit-codes'] === true ||
        (argv as { useExitCodes?: boolean }).useExitCodes === true ||
        (argv as { exitCodes?: boolean }).exitCodes === true;
      if (useExit && typeof process.exitCode !== 'number') process.exitCode = 0;
    } catch (err) {
      const out = {
        ok: false as const,
        stage: 'cli' as const,
        error: 'adapter_error' as const,
        message: (err as Error).message,
      };
      if (argv.json === true) writeJsonStderr(out);
      else console.error('ERROR:', out.message);
      const useExit =
        argv['use-exit-codes'] === true ||
        argv['exit-codes'] === true ||
        (argv as { useExitCodes?: boolean }).useExitCodes === true ||
        (argv as { exitCodes?: boolean }).exitCodes === true;
      if (useExit) process.exitCode = 1;
    }
  },
};
export default adaptersCmd;
