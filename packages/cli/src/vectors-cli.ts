// packages/cli/src/vectors-cli.ts
// Subcommand dispatcher for `zkpip vectors ...`
// - Keeps existing POC: `verify-seal`
// - Adds: `seal` (sign vector → sealed.json)
//   English comments, strict TS, Node 22+, ESM. No `any`.

import path from 'node:path';
import { readFile as fspReadFile, writeFile as fspWriteFile, mkdir as fspMkdir, writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';

import type { SealedVectorPOC, VerifySealResult } from './commands/verifySeal.js';
import { verifySealedVectorPOC } from './commands/verifySeal.js';

import { signVector } from './lib/signVector.js';
import { defaultStoreRoot } from './utils/keystore.js';
import { resolvePrivateKeyPath } from './utils/keystore-resolve.js';
import { VectorsPullArgs } from './commands/vectors-pull.js';
import { runVectorsSign, VectorsSignOptions } from './commands/vectors-sign.js';
import { runVectorsPull } from './utils/runVectorsPull.js';

// --------- tiny argv parser (posix-ish, no short flags packing) ---------
type Flags = Readonly<Record<string, string | boolean>>;

export async function runVectorsCli(argv: ReadonlyArray<string>): Promise<void> {
  const { sub, rest, flags } = splitArgs(argv);

  if (!sub || flags['help'] || flags['h']) {
    printVectorsHelp();
    process.exitCode = 0;
    return;
  }

  if (sub === 'verify-seal') {
    await runVerifySeal(rest, flags);
    return;
  }

  if (sub === 'seal') {
    await runSeal(rest, flags);
    return;
  }

  if (sub === 'pull') {
    const args: VectorsPullArgs = {
      ...(typeof flags['id'] === 'string'  ? { id:  String(flags['id']) }   : {}),
      ...(typeof flags['url'] === 'string' ? { url: String(flags['url']) }  : {}),
      out: typeof flags['out'] === 'string' ? String(flags['out']) : '',
    };
    if (!args.out || (!('id' in args) && !('url' in args))) {
      console.error(JSON.stringify({ ok:false, code:'MISSING_ARGS', message:'Need --url (or --id) and --out' }));
      process.exitCode = 1;
      return;
    }
    process.exitCode = await runVectorsPull(args);
    return;
  }

  if (sub === 'sign') {
    const options: VectorsSignOptions = {
      inPath:  typeof flags['in']  === 'string' ? String(flags['in'])  : '',
      outPath: typeof flags['out'] === 'string' ? String(flags['out']) : '',
      ...(typeof flags['key-dir'] === 'string' ? { keyDir: String(flags['key-dir']) } : {}),
    };
    if (!options.inPath || !options.outPath) {
      console.error(JSON.stringify({ ok:false, code:'MISSING_ARGS', message:'Need --in and --out (and optionally --key-dir)' }));
      process.exitCode = 1;
      return;
    }
    process.exitCode = await runVectorsSign(options);
    return;
  }

  if (sub === 'push') {
    // Accept many aliases to match old tests/helpers
    const id     = pickString(flags, ['id', 'vector-id', 'urn']);
    const store  = pickString(flags, ['store', 'out-dir', 'dir', 'base', 'base-dir', 'root']);
    const dataArg= pickString(flags, ['data', 'body', 'payload', 'content']);
    const inFile = pickString(flags, ['in', 'input', 'file', 'from']);

    if (!id || !store || (!dataArg && !inFile)) {
      console.error(JSON.stringify({ ok:false, code:'MISSING_ARGS', message:'Need --id --store and (--data or --in)' }));
      process.exitCode = 1;
      return;
    }

    try {
      const root = resolvePath(store);
      await fspMkdir(root, { recursive: true });

      const body = dataArg || await fspReadFile(resolvePath(inFile), 'utf8');

      const safe = id.replace(/[^a-zA-Z0-9:._-]/g, '_');
      const outPath = join(root, `${safe}.json`);
      await fspMkdir(dirname(outPath), { recursive: true });
      await fspWriteFile(outPath, body, 'utf8');

      console.log(`stored:${id}`);
      process.exitCode = 0;
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({ ok:false, code:'PUSH_FAILED', message: msg }));
      process.exitCode = 1;
      return;
    }
  }

  // Unknown vectors subcommand
  console.error(JSON.stringify({ ok: false, code: 'UNKNOWN_VECTORS_SUBCOMMAND', message: `Unknown vectors subcommand: ${sub}` }));
  process.exitCode = 1;
}

function pickString(flags: Flags, keys: ReadonlyArray<string>): string {
  for (const k of keys) {
    const v = flags[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

function splitArgs(argv: ReadonlyArray<string>): {
  sub: string | undefined;
  rest: ReadonlyArray<string>;
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
        const key = tok.slice(2, eq);
        const val = tok.slice(eq + 1);
        flags[key] = val;
        continue;
      }
      const key = tok.slice(2);
      const next = tail[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }

    if (!endOfOptions && tok.startsWith('-') && tok.length > 1) {
      flags[tok.slice(1)] = true;
      continue;
    }
  }

  return { sub, rest: tail, flags };
}

function printVectorsHelp(): void {
  const msg =
    `zkpip vectors\n\n` +
    `Usage:\n` +
    `  zkpip vectors verify-seal --in <sealed.json> [--key-dir <dir>] [--json] [--use-exit-codes]\n` +
    `  zkpip vectors seal --in <vector.json> --out <sealed.json> --keyId <id> [--store <dir>] [--meta <file>] [--json] [--use-exit-codes]\n` +
    `\nOptions (verify-seal):\n` +
    `  --in <file>        Input sealed JSON file { vector, seal }\n` +
    `  --key-dir <dir>    Directory for public keys (default: ~/.zkpip/key)\n` +
    `  --json             Force JSON output (errors are always JSON)\n` +
    `  --use-exit-codes   Use non-zero exit codes on error (default true)\n` +
    `\nOptions (seal):\n` +
    `  --in <file>        Input vector JSON\n` +
    `  --out <file>       Output sealed JSON path\n` +
    `  --keyId <id>       Logical key identifier (same as used in "keys generate")\n` +
    `  --store <dir>      Keystore root directory (default: ~/.zkpip/key)\n` +
    `  --meta <file>      Optional JSON file with extra metadata (object with primitive values)\n` +
    `  --json             Force JSON output (errors are always JSON)\n` +
    `  --use-exit-codes   Use non-zero exit codes on error (default true)\n`;
  console.log(msg);
}

function emitVerify(result: VerifySealResult, forceJson: boolean): void {
  const asJson = forceJson || !result.ok;
  if (asJson) {
    console.log(JSON.stringify(result));
  } else {
    console.log(result.message);
  }
}

function mapExitCode(ok: boolean, code: number, useExitCodes: boolean): number {
  return useExitCodes ? (ok ? 0 : code) : 0;
}

// ---------------- verify-seal (POC) ----------------

async function runVerifySeal(_rest: ReadonlyArray<string>, flags: Flags): Promise<void> {
  const inPath = typeof flags['in'] === 'string' ? String(flags['in']) : '';
  const keyDir = typeof flags['key-dir'] === 'string' ? String(flags['key-dir']) : undefined;
  const forceJson = Boolean(flags['json']);
  const useExitCodes = flags['use-exit-codes'] === false ? false : true; // default true

  if (!inPath) {
    console.error(JSON.stringify({ ok: false, code: 2, stage: 'io', error: 'MISSING_INPUT', message: 'Missing --in <file>' }));
    process.exitCode = mapExitCode(false, 2, useExitCodes);
    return;
  }

  try {
    const raw = await readFile(inPath, 'utf8');
    const json = JSON.parse(raw) as SealedVectorPOC;
    const opts: Readonly<{ keyDir?: string }> = { ...(keyDir ? { keyDir } : {}) };
    const res = verifySealedVectorPOC(json, opts);
    emitVerify(res, forceJson);
    process.exitCode = mapExitCode(res.ok, res.code, useExitCodes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = { ok: false as const, code: 2 as const, stage: 'io' as const, error: 'READ_FAILED', message: msg };
    emitVerify(err, true);
    process.exitCode = mapExitCode(false, err.code, useExitCodes);
  }
}

// ---------------- seal (new) ----------------

type Meta = Record<string, string | number | boolean>;

async function runSeal(_rest: ReadonlyArray<string>, flags: Flags): Promise<void> {
  const inPath = typeof flags['in'] === 'string' ? String(flags['in']) : '';
  const outPath = typeof flags['out'] === 'string' ? String(flags['out']) : '';
  const keyId = typeof flags['keyId'] === 'string' ? String(flags['keyId']) : '';
  const store = typeof flags['store'] === 'string' ? String(flags['store']) : defaultStoreRoot();
  const metaPath = typeof flags['meta'] === 'string' ? String(flags['meta']) : undefined;
  const forceJson = Boolean(flags['json']);
  const useExitCodes = flags['use-exit-codes'] === false ? false : true; // default true

  // Basic arg validation
  if (!inPath || !outPath || !keyId) {
    const errMsg = !inPath ? 'Missing --in <file>'
      : !outPath ? 'Missing --out <file>'
      : 'Missing --keyId <id>';
    const payload = { ok: false as const, code: 1 as const, stage: 'args' as const, error: 'MISSING_ARG', message: errMsg };
    console.error(JSON.stringify(payload));
    process.exitCode = mapExitCode(false, payload.code, useExitCodes);
    return;
  }

  try {
    // 1) Load vector JSON
    const raw = await readFile(path.resolve(inPath), 'utf8');
    const vector: unknown = JSON.parse(raw);

    // 2) Optional meta
    let meta: Meta | undefined;
    if (metaPath) {
      const metaRaw = await readFile(path.resolve(metaPath), 'utf8');
      const parsed = JSON.parse(metaRaw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        meta = parsed as Meta;
      } else {
        const payload = { ok: false as const, code: 1 as const, stage: 'args' as const, error: 'META_INVALID', message: 'Meta must be a JSON object (primitive values only)' };
        console.error(JSON.stringify(payload));
        process.exitCode = mapExitCode(false, payload.code, useExitCodes);
        return;
      }
    }

    // 3) Resolve and read private key
    const keyRoot = path.resolve(store);
    const privatePemPath = await resolvePrivateKeyPath(keyRoot, keyId);
    if (!privatePemPath) {
      const payload = { ok: false as const, code: 2 as const, stage: 'keystore' as const, error: 'KEY_NOT_FOUND', message: `Private key not found for keyId="${keyId}" under "${keyRoot}"` };
      console.error(JSON.stringify(payload));
      process.exitCode = mapExitCode(false, payload.code, useExitCodes);
      return;
    }
    const privatePem = await readFile(privatePemPath, 'utf8');

    // 4) Sign
    const sealed = signVector({
      vector,
      privateKeyPem: privatePem,
      kid: keyId,
      ...(meta !== undefined ? { meta } : {}),
    });

    // 5) Write output
    const absOut = path.resolve(outPath);
    await mkdir(path.dirname(absOut), { recursive: true });
    await writeFile(absOut, JSON.stringify(sealed, null, 2) + '\n', { encoding: 'utf8' });

    const okPayload = {
      ok: true as const,
      code: 0 as const,
      out: absOut,
      vectorUrn: sealed.vectorUrn,
      envelopeId: sealed.envelopeId,
      keyId,
    };

    if (forceJson) {
      console.log(JSON.stringify(okPayload));
    } else {
      console.log(`✅ Sealed vector → ${absOut}`);
      console.log(`   URN: ${sealed.vectorUrn}`);
      console.log(`   Env: ${sealed.envelopeId}`);
      console.log(`   Key: ${keyId}`);
    }
    process.exitCode = mapExitCode(true, 0, useExitCodes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const payload = { ok: false as const, code: 4 as const, stage: 'io' as const, error: 'SEAL_FAILED', message: msg };
    console.error(JSON.stringify(payload));
    process.exitCode = mapExitCode(false, payload.code, useExitCodes);
  }
}
