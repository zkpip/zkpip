// packages/cli/src/commands/adapters.ts
import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { getAllAdapters } from '../registry/adapterRegistry.js';

type Options = {
  json: boolean;
};

function formatTable(rows: string[][]): string {
  // oszlopszélességek
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => (r[col] ?? '').length)));
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));

  const [header, ...body] = rows;
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  const out: string[] = [];
  out.push(widths.map((w, i) => pad(header[i] ?? '', w)).join('  '));
  out.push(sep);
  for (const r of body) out.push(widths.map((w, i) => pad(r[i] ?? '', w)).join('  '));
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
  handler(argv: ArgumentsCamelCase<Options>) {
    const list = getAllAdapters().map((a) => ({
      id: a.id,
      proofSystem: a.proofSystem,
      framework: a.framework,
    }));

    if (argv.json) {
      console.log(JSON.stringify({ ok: true, adapters: list }, null, 2));
      return;
    }

    const rows: string[][] = [
      ['ID', 'Proof system', 'Framework'],
      ...list.map((a) => [a.id, a.proofSystem, a.framework]),
    ];
    console.log(formatTable(rows));
  },
};
