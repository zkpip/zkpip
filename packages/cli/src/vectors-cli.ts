// ESM, strict TS. Minimal argv parser for `zkpip vectors <subcmd>` (currently: pull)
import { vectorsSign } from './commands/vectors-sign.js';
import { vectorsVerifySeal } from './commands/vectors-verify-seal.js';
import { runVectorsPull } from './utils/runVectorsPull.js';
import { vectorsPush } from './commands/vectors-push.js';

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
  const [sub, ...rest] = argv
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    console.log(`Usage:
  zkpip vectors pull --id <urn>|--url <http> --out <file>
`);
    process.exitCode = 0;
    return;
  }

  if (sub === 'sign') {
    const inIdx = rest.indexOf('--in');
    const outIdx = rest.indexOf('--out');
    const keyIdx = rest.indexOf('--key-dir');

    const inPath  = inIdx >= 0 ? rest[inIdx + 1] : undefined;
    const outPath = outIdx >= 0 ? rest[outIdx + 1] : undefined;
    const keyDirArg = keyIdx >= 0 ? rest[keyIdx + 1] : undefined;

    if (!inPath || !outPath) {
      const err = new Error('Usage: zkpip vectors sign --in <file.json> --out <sealed.json> [--key-dir <dir>]');
      (err as Error & { code: string }).code = 'ZK_CLI_ERR_USAGE';
      throw err;
    }

    await vectorsSign({ 
      inPath, 
      outPath, 
      ...(keyDirArg ? { keyDir: keyDirArg } : {}),
    }); 
    return;
  }  

  if (sub === 'push') {
    const idIdx = rest.indexOf('--id');
    const inIdx = rest.indexOf('--in');
    const baseIdx = rest.indexOf('--base-dir'); // local disk root
    const id = idIdx >= 0 ? rest[idIdx + 1] : undefined;
    const inPath = inIdx >= 0 ? rest[inIdx + 1] : undefined;
    const baseDir = baseIdx >= 0 ? rest[baseIdx + 1] : '.zkpip-vectors';
    const effectiveBaseDir = baseDir ?? '.zkpip-vectors';

    if (!id || !inPath) {
      const err = new Error('Usage: zkpip vectors push --id <urn> --in <file> [--base-dir <dir>]');
      (err as Error & { code: string }).code = 'ZK_CLI_ERR_USAGE';
      throw err;
    }

    await vectorsPush({ id, inPath, baseDir: effectiveBaseDir });
    return;
  }

  if (sub === 'verify-seal') {
    const inIdx = rest.indexOf('--in');
    const keyIdx = rest.indexOf('--key-dir');
    const inPath = inIdx >= 0 ? rest[inIdx + 1] : undefined;
    const keyDir = keyIdx >= 0 ? rest[keyIdx + 1] : undefined;
    if (!inPath) {
      const err = new Error('Usage: zkpip vectors verify-seal --in <vector+seal.json> [--key-dir <dir>]');
      (err as Error & { code: string }).code = 'ZK_CLI_ERR_USAGE';
      throw err;
    }
    await vectorsVerifySeal({ inPath, ...(keyDir ? { keyDir } : {}) });
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
