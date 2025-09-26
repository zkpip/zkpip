// packages/cli/src/verify-cli.ts
import type { VerifyHandlerArgs } from './types/cli.js';
import { handler as verifyHandler } from './commands/verify.js';
import { composeHelp } from './help.js';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeJsonStable, type Json } from './utils/normalizeJsonStable.js';

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
  const dash = `--${name}`;
  return argv.includes(dash);
}

/** Resolve verification source: inline JSON, stdin ("-"), or filesystem path. */
async function resolveVerificationSource(src: string): Promise<{ raw: string; source: 'inline' | 'stdin' | 'file' }> {
  const trimmed = src.trim();
  if (trimmed === '-') {
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      process.stdin.on('data', (c: Buffer) => chunks.push(c));
      process.stdin.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      process.stdin.once('error', reject);
      process.stdin.resume();
    });
    return { raw, source: 'stdin' };
  }
  // Inline JSON if looks like JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return { raw: trimmed, source: 'inline' };
  }
  // Else treat as file path
  const raw = await readFile(src, 'utf8');
  return { raw, source: 'file' };
}

type ErrLike = Error & Partial<{ code: string; name: string }>;

function toExitCode(e: unknown, useExitCodes: boolean): number {
  if (!useExitCodes) return 1;
  const err = e as ErrLike;
  const code = (err && err.code) || '';

  // 2 → I/O / ENOENT
  if (code === 'ENOENT' || /ENOENT/i.test((err as Error).message ?? '')) return 2;

  if (code === 'ZK_SCHEMA_INVALID' || code === 'AJV_VALIDATION_ERROR' || err.name === 'AjvError' || /schema/i.test(err.message ?? '')) {
    return 3;
  }

  // default
  return 1;
}

function readOpt(argv: readonly string[], name: string): string | undefined {
  const dash = `--${name}`;
  const i = argv.indexOf(dash);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function runVerifyCli(argv: readonly string[]): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
    printVerifyHelp();
    return;
  }

  const verificationOpt = readOpt(argv, 'verification');
  const adapter = readOpt(argv, 'adapter');
  const dumpPath = readOpt(argv, 'dump-normalized');

  // teszt DX: default JSON out = true
  const json = hasFlag(argv, 'json') || true;

  const skipSchema =
    hasFlag(argv, 'skip-schema') ||
    hasFlag(argv, 'no-schema');

  const useExitCodes =
    hasFlag(argv, 'use-exit-codes') ||
    hasFlag(argv, 'exit-codes') ||
    hasFlag(argv, 'useExitCodes') ||
    hasFlag(argv, 'exitCodes') ||
    true;

  if (!verificationOpt) {
    const message = 'Missing --verification <path | ->';
    if (json) console.error(JSON.stringify({ ok: false, code: 'VERIFY_ERROR', message }));
    process.exitCode = toExitCode(new Error(message), useExitCodes);
    return;
  }

  try {
    // 1) Source resolve (inline / stdin / file)
    const { raw } = await resolveVerificationSource(verificationOpt);

    // 2) Parse (dump parse-fail is _error)
    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(raw) as unknown;
    } catch (e) {
      if (dumpPath) {
        await mkdir(dirname(dumpPath), { recursive: true });
        await writeFile(dumpPath, JSON.stringify({ _error: 'json-parse-failed' }, null, 2), 'utf8');
      }
      throw e;
    }

    // 3) Normalize & early dump
    const normalized: Json = normalizeJsonStable(parsedUnknown);
    if (dumpPath) {
      await mkdir(dirname(dumpPath), { recursive: true });
      await writeFile(dumpPath, JSON.stringify(normalized, null, 2), 'utf8');
    }

    const args: VerifyHandlerArgs = {
      ...(adapter ? { adapter } : {}),
      verification: verificationOpt,
      json,
      useExitCodes,
      noSchema: skipSchema,
    };

    await verifyHandler(args);

    // success
    process.exitCode = 0;
    if (json) process.stdout.write(JSON.stringify({ ok: true }));
  } catch (err) {
    const exit = toExitCode(err, useExitCodes);
    process.exitCode = exit;

    // Map exit→(error, stage)
    let errorTag: 'io_error' | 'schema_invalid' | 'verify_error' | 'adapter_not_found';
    let stage: 'io' | 'schema' | 'verify';
    switch (exit) {
      case 2:
        errorTag = 'io_error';
        stage = 'io';
        break;
      case 3:
        errorTag = 'schema_invalid';
        stage = 'schema';
        break;
      case 4:
        errorTag = 'adapter_not_found';
        stage = 'verify';
        break;        
      default:
        errorTag = 'verify_error';
        stage = 'verify';
        break;
    }

    const e = err as Error & Partial<{ code: string }>;
    const code = e.code ?? (exit === 2 ? 'ENOENT' : exit === 3 ? 'ZK_SCHEMA_INVALID' : 'VERIFY_ERROR');
    const message = e.message ?? String(err);

    if (json) {
      console.error(JSON.stringify({ ok: false, code, error: errorTag, stage, message }));
    } else {
      console.error(`${stage}: ${message}`);
    }
  }
}
