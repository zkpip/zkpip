// packages/cli/src/forge-cli.ts

import { runForge } from './utils/runForge.js';
import type { RunForgeArgs } from './utils/runForge.js';
import type { AdapterId } from './registry/adapterRegistry.js';
import { composeHelp } from './help.js';

export interface ForgeCliArgs {
  inDir: string;
  pretty: boolean;
  adapter?: AdapterId;
  outFile?: string;
  invalidOutDir?: string;
}

function parseForgeArgv(argv: string[]): ForgeCliArgs {
  let inDir = '';
  let adapter: AdapterId | undefined;
  let outFile: string | undefined;
  let invalidOutDir: string | undefined;
  let pretty = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in')             { inDir = argv[++i] ?? ''; continue; }
    if (a === '--adapter')        {
      const v = argv[++i] ?? '';
      if (v === 'snarkjs-groth16' || v === 'snarkjs-plonk' || v === 'zokrates-groth16') adapter = v;
      else throw new Error(`Unknown adapter: ${v}`);
      continue;
    }
    if (a === '--out')            { outFile = argv[++i] ?? ''; continue; }
    if (a === '--invalid-out')    { invalidOutDir = argv[++i] ?? ''; continue; }
    if (a === '--pretty')         { pretty = true; continue; }
  }

  if (!inDir) throw new Error('Missing required --in <dir>');

  // Only include optional keys when they have values
  const args: ForgeCliArgs = {
    inDir,
    pretty,
    ...(adapter ? { adapter } : {}),
    ...(outFile ? { outFile } : {}),
    ...(invalidOutDir ? { invalidOutDir } : {}),
  };

  return args;
}

export function printForgeHelp(): void {
  const body = [
    'Usage:',
    '  zkpip forge --input <file> --out <file> --adapter <id> [--dry-run] [--strict] [--seed 0x...]',
    '',
    'Options:',
    '  --input            Path to input JSON',
    '  --out              Path to output envelope (omit with --dry-run)',
    '  --adapter          One of: snarkjs-groth16 | snarkjs-plonk | zokrates-groth16',
    '  --dry-run          Print to stdout only, no file writes',
    '  --strict           Treat suspicious fields as errors',
    '  --seed             0x-prefixed hex to derive deterministic envelopeId',
  ].join('\n');
  console.log(composeHelp(body));
}

export async function runForgeCli(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) { printForgeHelp(); return; }  
  try {
    const args = parseForgeArgv(argv);

    const runArgs: RunForgeArgs = {
      in: args.inDir,
      pretty: args.pretty,
      ...(args.adapter ? { adapter: args.adapter } : {}),
      ...(args.outFile ? { out: args.outFile } : {}),
      ...(args.invalidOutDir ? { invalidOut: args.invalidOutDir } : {}),
    };

    const code = await runForge(runArgs);
    process.exitCode = code;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(JSON.stringify({ ok: false, code: 'FORGE_ERROR', message }));
    process.exitCode = 1;
  }
}
