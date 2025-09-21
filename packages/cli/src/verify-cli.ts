// packages/cli/src/verify-cli.ts
import type { VerifyHandlerArgs } from './types/cli.js';
import { handler as verifyHandler } from './commands/verify.js';
import { composeHelp } from './help.js';

function printVerifyHelp(): void {
  const body = [
    'Usage:',
    '  zkpip verify --verification <path>|- [--adapter <id>] [--dump-normalized <path>] [--use-exit-codes] [--json]',
    '',
    'Options:',
    '  --verification <path>|-   Verification JSON path or "-" for stdin',
    '  --adapter <id>            Adapter override/enforce',
    '  --dump-normalized <path>  Write adapter-normalized bundle for debug',
    '  --use-exit-codes          Exit 0 on success, non-zero on failure',
    '  --json                    Structured output',
  ].join('\n');
  console.log(composeHelp(body));
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`) || argv.includes(`--no-${name}`);
}
function readFlag(argv: readonly string[], name: string): boolean | undefined {
  if (argv.includes(`--${name}`)) return true;
  if (argv.includes(`--no-${name}`)) return false;
  return undefined;
}
function readOpt(argv: readonly string[], name: string): string | undefined {
  const ix = argv.findIndex((a) => a === `--${name}`);
  if (ix >= 0 && ix + 1 < argv.length) return argv[ix + 1];
  const pref = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : undefined;
}

export async function runVerifyCli(argv: readonly string[]): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
    printVerifyHelp();
    return;
  }

  // parse: --verification (required), --adapter, --json, --skip-schema|--no-schema, --use-exit-codes (legacy-friendly)
  const verification = readOpt(argv, 'verification');
  const adapter = readOpt(argv, 'adapter');
  const json = readFlag(argv, 'json') ?? true; // default JSON on in tests
  const skipSchema =
    readFlag(argv, 'skip-schema') ??
    (hasFlag(argv, 'no-schema') ? true : undefined) ??
    false;

  const args: VerifyHandlerArgs = {
    ...(adapter ? { adapter } : {}),
    ...(verification ? { verification } : {}),
    json,
    useExitCodes:
      readFlag(argv, 'use-exit-codes') ??
      readFlag(argv, 'exit-codes') ??
      readFlag(argv, 'useExitCodes') ??
      readFlag(argv, 'exitCodes') ??
      true,
    noSchema: skipSchema,
  };

  await verifyHandler(args);
}
