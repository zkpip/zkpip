// packages/cli/src/commands/adapters.ts
import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { getAllAdapters } from '../registry/adapterRegistry.js';

type Options = {
  readonly json: boolean;
};

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

export const adaptersCmd: CommandModule<object, Options> = {
  command: 'adapters',
  describe: 'List available verification adapters',
  builder(y) {
    return y.option('json', {
      type: 'boolean',
      default: false,
      describe: 'Emit machine-readable JSON output',
    });
  },
  async handler(argv: ArgumentsCamelCase<Options>): Promise<void> {
    // await needed: getAllAdapters() is async
    const adapters = await getAllAdapters();

    const list = adapters.map((a) => ({
      id: a.id,
      proofSystem: a.proofSystem ?? '',
      framework: a.framework ?? '',
    }));

    if (argv.json) {
      console.log(JSON.stringify({ ok: true, adapters: list }, null, 2));
      return;
    }

    const rows: string[][] =
      list.length === 0
        ? []
        : [
            ['ID', 'Proof system', 'Framework'],
            ...list.map((a) => [a.id, a.proofSystem, a.framework]),
          ];

    console.log(formatTable(rows));
  },
};
