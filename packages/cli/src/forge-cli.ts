// packages/cli/src/forge-cli.ts
// ESM, strict TS, no "any" — CLI dispatcher for `forge`.
// Adds: --dry-run (no --in required), --seed 0x..., --strict, --json handling.
//
// In dry-run mode we DO NOT call runForge; we emit a deterministic payload
// so tests can assert repeatability without touching filesystem.

import { runForge } from './utils/runForge.js';
import type { RunForgeArgs } from './utils/runForge.js';
import type { AdapterId } from './registry/adapterRegistry.js';
import { composeHelp } from './help.js';
import { ExitCode } from './utils/exit.js';

// ---------- Types ----------
export interface ForgeCliArgs {
  // When dryRun is true, inDir is optional.
  inDir?: string;
  pretty: boolean;
  adapter?: AdapterId;
  outFile?: string;
  invalidOutDir?: string;
  dryRun: boolean;
  strict: boolean;
  json: boolean;
  seedHex?: string; // 0x-prefixed hex for deterministic behavior
}

// ---------- Small helpers ----------
function isAdapterId(v: string): v is AdapterId {
  return v === 'snarkjs-groth16' || v === 'snarkjs-plonk' || v === 'zokrates-groth16';
}

function isHexSeed(v: string): boolean {
  // Accepts 0x followed by even-length hex (empty payload like "0x" is rejected)
  return /^0x[0-9a-fA-F]+$/.test(v) && ((v.length - 2) % 2 === 0);
}

function readKV(argv: readonly string[], name: string): string | undefined {
  // Support both "--name value" and "--name=value"
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === name) return argv[i + 1];
    if (a.startsWith(name + '=')) return a.slice(name.length + 1);
  }
  return undefined;
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

function parseForgeArgv(argv: readonly string[]): ForgeCliArgs {
  const inDir = readKV(argv, '--in');
  const adapterStr = readKV(argv, '--adapter');
  const outFile = readKV(argv, '--out');
  const invalidOutDir = readKV(argv, '--invalid-out');
  const pretty = hasFlag(argv, '--pretty');
  const dryRun = hasFlag(argv, '--dry-run');
  const strict = hasFlag(argv, '--strict');
  const json = hasFlag(argv, '--json');
  const seedHex = readKV(argv, '--seed');

  if (adapterStr && !isAdapterId(adapterStr)) {
    throw new Error(`Unknown adapter: ${adapterStr}`);
  }
  if (seedHex && !isHexSeed(seedHex)) {
    throw new Error(`Invalid --seed (expected 0x-prefixed even-length hex): ${seedHex}`);
  }

  // Validation:
  // - In normal mode, --in is required.
  // - In dry-run mode, --in is not required, but --seed is required for determinism.
  if (!dryRun && !inDir) {
    throw new Error('Missing required --in <dir>');
  }
  if (dryRun && !seedHex) {
    throw new Error('Missing --seed <0x...> in --dry-run mode');
  }

  // Build args without undefined properties (exactOptionalPropertyTypes safe)
  const args: ForgeCliArgs = {
    pretty,
    dryRun,
    strict,
    json,
    ...(inDir ? { inDir } : {}),
    ...(adapterStr ? { adapter: adapterStr as AdapterId } : {}),
    ...(outFile ? { outFile } : {}),
    ...(invalidOutDir ? { invalidOutDir } : {}),
    ...(seedHex ? { seedHex } : {}),
  };

  return args;
}

export function printForgeHelp(): void {
  const body = [
    'Usage:',
    '  zkpip forge --in <dir> --out <file> --adapter <id> [--strict] [--pretty] [--json]',
    '  zkpip forge --dry-run --seed 0x... [--adapter <id>] [--pretty] [--json]',
    '',
    'Options:',
    '  --in <dir>         Input directory (required unless --dry-run)',
    '  --out <file>       Output envelope path (omit in --dry-run)',
    '  --invalid-out <d>  Output directory for invalid vectors',
    '  --adapter <id>     snarkjs-groth16 | snarkjs-plonk | zokrates-groth16',
    '  --strict           Treat disallowed fields as errors',
    '  --pretty           Pretty-print JSON output files',
    '  --json             Emit machine-readable JSON to stdout',
    '  --dry-run          No filesystem writes; emit deterministic payload',
    '  --seed 0x...       0x-prefixed even-length hex (required in --dry-run)',
  ].join('\n');
  console.log(composeHelp(body));
}

/**
 * CLI handler for "forge".
 * Returns an ExitCode. Does NOT hard-exit; the entrypoint sets process.exitCode.
 */
export async function runForgeCli(args: readonly string[]): Promise<ExitCode> {
  // Local help handling
  if (args.includes('--help') || args.includes('-h')) {
    printForgeHelp();
    return ExitCode.OK;
  }

  // Preserve your legacy quick check for plain "forge" invocations that forgot --in/--dry-run,
  // but do NOT exit here; just return a code.
  const argvIn = process.argv.slice(2);
  const isForge = argvIn[0] === 'forge';
  const hasIn =
    argvIn.some(
      (a) =>
        a === '--in' ||
        a.startsWith('--in=') ||
        a === '--inDir' || // legacy compat if exists
        a.startsWith('--inDir='),
    );
  const hasDryRun = argvIn.includes('--dry-run');

  if (isForge && !hasIn && !hasDryRun) {
    const note = 'Missing --in option';
    process.stderr.write(JSON.stringify({ ok: false, code: 'FORGE_ERROR', message: note }) + '\n');
    return ExitCode.INVALID_ARGS;
  }

  try {
    const parsed = parseForgeArgv(args);

    // Dry-run path: no call to runForge; we emit deterministic content.
    if (parsed.dryRun) {
      const payload = {
        mode: 'dry-run' as const,
        seed: parsed.seedHex!, // validated in parse
        adapter: parsed.adapter ?? null,
        strict: parsed.strict,
        pretty: parsed.pretty,
      };

      if (parsed.json) {
        process.stdout.write(JSON.stringify({ ok: true, result: payload }) + '\n');
      } else {
        console.log('Forge dry-run OK');
      }
      return ExitCode.OK;
    }

    // Normal mode: call runForge
    const inArg: string = typeof parsed.inDir === 'string' ? parsed.inDir : '';

    const runArgs: RunForgeArgs = {
      in: inArg.trim(), // never undefined
      pretty: parsed.pretty === true,
      ...(parsed.adapter ? { adapter: parsed.adapter } : {}),
      ...(parsed.outFile ? { out: parsed.outFile } : {}),
      ...(parsed.invalidOutDir ? { invalidOut: parsed.invalidOutDir } : {}),
    };

    const code = await runForge(runArgs);
    return code;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // stderr for humans; JSON for machines if someone relies on it
    process.stderr.write(JSON.stringify({ ok: false, code: 'FORGE_ERROR', message }) + '\n');
    return ExitCode.UNEXPECTED;
  }
}
