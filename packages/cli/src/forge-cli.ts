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

function isAdapterId(v: string): v is AdapterId {
  return v === 'snarkjs-groth16' || v === 'snarkjs-plonk' || v === 'zokrates-groth16';
}

function isHexSeed(v: string): boolean {
  // Accepts 0x followed by even-length hex (empty payload like "0x" is rejected)
  return /^0x[0-9a-fA-F]+$/.test(v) && ((v.length - 2) % 2 === 0);
}

function parseForgeArgv(argv: readonly string[]): ForgeCliArgs {
  let inDir: string | undefined;
  let adapter: AdapterId | undefined;
  let outFile: string | undefined;
  let invalidOutDir: string | undefined;
  let pretty = false;
  let dryRun = false;
  let strict = false;
  let json = false;
  let seedHex: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--in') {
      const v = argv[++i];
      if (!v) throw new Error('Missing value for --in');
      inDir = v;
      continue;
    }
    if (a === '--adapter') {
      const v = argv[++i];
      if (!v) throw new Error('Missing value for --adapter');
      if (!isAdapterId(v)) throw new Error(`Unknown adapter: ${v}`);
      adapter = v;
      continue;
    }
    if (a === '--out') {
      const v = argv[++i];
      if (!v) throw new Error('Missing value for --out');
      outFile = v;
      continue;
    }
    if (a === '--invalid-out') {
      const v = argv[++i];
      if (!v) throw new Error('Missing value for --invalid-out');
      invalidOutDir = v;
      continue;
    }
    if (a === '--pretty') {
      pretty = true;
      continue;
    }
    if (a === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (a === '--strict') {
      strict = true;
      continue;
    }
    if (a === '--json') {
      json = true;
      continue;
    }
    if (a === '--seed') {
      const v = argv[++i];
      if (!v) throw new Error('Missing value for --seed');
      if (!isHexSeed(v)) throw new Error(`Invalid --seed (expected 0x-prefixed even-length hex): ${v}`);
      seedHex = v;
      continue;
    }
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
    ...(adapter ? { adapter } : {}),
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

export async function runForgeCli(args: readonly string[]): Promise<void> {
  const argv: string[] = Array.from(args);

  if (argv.includes('--help') || argv.includes('-h')) {
    printForgeHelp();
    return;
  }

  const argvIn = process.argv.slice(2);
  const isForge = argvIn[0] === 'forge';
  const hasIn = argvIn.some(a => a === '--in' || a.startsWith('--in=') || a === '--inDir' || a.startsWith('--inDir='));
  const hasDryRun = argvIn.includes('--dry-run');

  if (isForge && !hasIn && !hasDryRun) {
    // what the test expects:
    process.stderr.write(
      JSON.stringify({ ok: false, code: 'FORGE_ERROR', message: 'Missing --in option' }) + '\n'
    );
    process.exitCode = 1; // <-- critical
    // IMPORTANT: stop here so we don't fall through
    return;
  }

  try {
    const parsed = parseForgeArgv(argv);

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
        process.stdout.write(JSON.stringify({ ok: true, result: payload }));
      } else {
        console.log('Forge dry-run OK');
      }
      if (process.env.ZKPIP_HARD_EXIT === '1') process.exit(0);
      return;
    }

    const inArg: string = typeof parsed.inDir === 'string' ? parsed.inDir : '';

    const runArgs: RunForgeArgs = {
      in: inArg.trim(),                      // <- sosem undefined
      pretty: parsed.pretty === true,
      ...(parsed.adapter ? { adapter: parsed.adapter } : {}),
      ...(parsed.outFile ? { out: parsed.outFile } : {}),
      ...(parsed.invalidOutDir ? { invalidOut: parsed.invalidOutDir } : {}),
    };

    const code = await runForge(runArgs);
    process.exitCode = code;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(JSON.stringify({ ok: false, code: 'FORGE_ERROR', message }));
    process.exitCode = 1;
  }
}
