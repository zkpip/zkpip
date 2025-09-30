// Tiny subcommand dispatcher for `zkpip keys ...` (ESM, strict TS, no yargs)
// - supports: `keys generate`
// - flags: --store, --label, --keyId, --json

import { defaultStoreRoot } from './utils/keystore.js';
import { runKeysGenerate, type KeysGenerateOptions } from './commands/keys-generate.js';
import { runKeysShow } from './commands/keys/show.js';

type Flags = Readonly<Record<string, string | boolean>>;

export async function runKeysCli(argv: ReadonlyArray<string>): Promise<void> {
  const { sub, flags } = splitArgs(argv);

  if (!sub || flags['help'] || flags['h']) {
    printKeysHelp();
    process.exitCode = 0;
    return;
  }

  if (sub === 'generate') {
    const outDir = typeof flags['store'] === 'string'
      ? String(flags['store'])
      : defaultStoreRoot();

    const options: KeysGenerateOptions = {
      outDir,
      ...(typeof flags['label'] === 'string' ? { label: String(flags['label']) } : {}),
      ...(typeof flags['keyId'] === 'string' ? { keyId: String(flags['keyId']) } : {}),
      ...(flags['json'] ? { json: true } : {}),
    };

    const code = await runKeysGenerate(options);
    process.exitCode = code;
    return;
  }

  if (sub === 'show') {
    const keyId = typeof flags['keyId'] === 'string' ? String(flags['keyId']) : '';
    const store = typeof flags['store'] === 'string' ? String(flags['store']) : undefined;
    const json  = Boolean(flags['json']);

    if (!keyId) {
      console.error(JSON.stringify({ ok:false, code:1, error:'MISSING_ARG', message:'Need --keyId' }));
      process.exitCode = 1;
      return;
    }

    process.exitCode = await runKeysShow({ keyId, ...(store ? { store } : {}), ...(json ? { json:true } : {}) });
    return;
  }

  console.error(JSON.stringify({
    ok: false as const,
    code: 1 as const,
    error: 'UNKNOWN_KEYS_SUBCOMMAND',
    message: `Unknown keys subcommand: ${String(sub)}`,
  }));
  process.exitCode = 1;
}

function splitArgs(argv: ReadonlyArray<string>): {
  sub: string | undefined;
  flags: Flags;
} {
  const sub = argv[0];
  const tail = argv.slice(1);
  const flags: Record<string, string | boolean> = {};

  let endOfOptions = false;
  for (let i = 0; i < tail.length; i++) {
    const tok = tail[i]!;
    if (!endOfOptions && tok === '--') {
      endOfOptions = true;
      continue;
    }
    if (!endOfOptions && tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq !== -1) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
      } else {
        const key = tok.slice(2);
        const next = tail[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
      continue;
    }
    // rövid '-' flag-eket most nem támogatunk – egységes a vectors-cli-val
  }
  return { sub, flags };
}

function printKeysHelp(): void {
  const msg =
    `zkpip keys\n\n` +
    `Usage:\n` +
    `  zkpip keys generate --store <dir> [--label <txt>] [--keyId <kid>] [--json]\n` +
    `\nOptions (generate):\n` +
    `  --store <dir>   Keystore root directory (default: ~/.zkpip/key)\n` +
    `  --label <txt>   Optional human-friendly label\n` +
    `  --keyId <kid>   Optional override; must match derived keyId from SPKI\n` +
    `  --json          Machine-readable JSON output\n`;
  console.log(msg);
}
