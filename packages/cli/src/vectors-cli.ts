// ESM, strict TS. Minimal argv parser for `zkpip vectors <subcmd>` (currently: pull)
import { runVectorsPull } from './utils/runVectorsPull.js';

export interface VectorsPullArgs {
  id?: string;
  url?: string;
  out: string;
}

function parsePullArgv(argv: string[]): VectorsPullArgs {
  let id: string | undefined;
  let url: string | undefined;
  let out: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id')  { id = argv[++i]; continue; }
    if (a === '--url') { url = argv[++i]; continue; }
    if (a === '--out') { out = argv[++i]; continue; }
  }

  if (!out) throw new Error('Missing required --out <file>');
  if (!id && !url) throw new Error('Either --id or --url is required');

  // Only include optional keys when defined (no undefined on present keys)
  const args: VectorsPullArgs = {
    out,
    ...(id ? { id } : {}),
    ...(url ? { url } : {}),
  };

  return args;
}

export async function runVectorsCli(argv: string[]): Promise<void> {
  const sub = argv[0];
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    console.log(`Usage:
  zkpip vectors pull --id <urn>|--url <http> --out <file>
`);
    process.exitCode = 0;
    return;
  }

  if (sub === 'pull') {
    try {
      const args = parsePullArgv(argv.slice(1));
      const code = await runVectorsPull(args);
      process.exitCode = code;
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(JSON.stringify({ ok: false, code: 'VECTORS_PULL_ERROR', message }));
      process.exitCode = 1;
      return;
    }
  }

  console.error(JSON.stringify({ ok: false, code: 'UNKNOWN_SUBCOMMAND', message: `Unknown vectors subcommand: ${sub}` }));
  process.exitCode = 1;
}
