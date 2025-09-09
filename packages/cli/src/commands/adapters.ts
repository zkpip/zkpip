// packages/cli/src/commands/adapters.ts
/* eslint-disable no-console */
import type { CommandModule, ArgumentsCamelCase, Argv } from 'yargs';
import { getAllAdapters } from '../registry/adapterRegistry.js';

type Options = {
  readonly json: boolean;
  // support both spellings for CI/scripts
  readonly 'exit-codes': boolean;
  readonly exitCodes: boolean;
  readonly 'use-exit-codes': boolean;
  readonly useExitCodes: boolean;
};

// ---- util ---------------------------------------------------------------

function pad(s: string, w: number): string {
  const padLen = Math.max(0, w - s.length);
  return s + ' '.repeat(padLen);
}

function formatTable(rows: readonly string[][]): string {
  if (rows.length === 0) return 'No adapters registered.';

  const headerArr = rows[0];
  if (!headerArr) return 'No adapters registered.';
  const header: readonly string[] = headerArr;
  const body: readonly string[][] = rows.slice(1);

  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const widths = Array.from({ length: colCount }, (_, col) =>
    Math.max(...rows.map((r) => (r[col] ?? '').length))
  );

  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  const out: string[] = [];
  out.push(widths.map((w, i) => pad(header[i] ?? '', w)).join('  '));
  out.push(sep);
  for (const r of body) {
    out.push(widths.map((w, i) => pad(r[i] ?? '', w)).join('  '));
  }
  return out.join('\n');
}

/** Flush stdout/stderr, then exit immediately (prompt-friendly). */
function exitNow(code: 0 | 1 | 2 | 3 | 4): void {
  try {
    process.stdout.write('', () => {
      process.stderr.write('', () => process.exit(code));
    });
  } catch {
    process.exit(code);
  }
}

// ---- command ------------------------------------------------------------

export const adaptersCmd: CommandModule<object, Options> = {
  command: 'adapters',
  describe: 'List available verification adapters',
  builder(y: Argv<object>) {
    return y
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Emit machine-readable JSON output',
      })
      .option('exit-codes', {
        type: 'boolean',
        default: false,
        describe: 'Return exit code 0 on success (for CI)',
      })
      .option('use-exit-codes', {
        type: 'boolean',
        default: false,
        describe: 'Alias for --exit-codes',
      })
      .parserConfiguration({ 'camel-case-expansion': true }) as Argv<Options>;
  },
  async handler(argv: ArgumentsCamelCase<Options>): Promise<void> {
    const useExitCodes = !!(
      argv['exit-codes'] || argv.exitCodes || argv['use-exit-codes'] || argv.useExitCodes
    );

    try {
      const adapters = await getAllAdapters();
      const list = adapters.map((a) => ({
        id: a.id,
        proofSystem: a.proofSystem ?? '',
        framework: a.framework ?? '',
      }));

      if (argv.json) {
        console.log(JSON.stringify({ ok: true, adapters: list }, null, 2));
      } else {
        const rows: string[][] =
          list.length === 0
            ? []
            : [
                ['ID', 'Proof system', 'Framework'],
                ...list.map((a) => [a.id, a.proofSystem, a.framework]),
              ];
        console.log(formatTable(rows));
      }

      if (useExitCodes) exitNow(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (argv.json) {
        console.error(JSON.stringify({ ok: false, error: 'adapter_list_failed', message: msg }, null, 2));
      } else {
        console.error('ERROR:', msg);
      }
      if (useExitCodes) exitNow(4);
    }
  },
};
