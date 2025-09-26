// CLI: `zkpip seal --in <vector.json> --out <sealed.json> --keyId <id> [--store <dir>] [--meta <meta.json>] [--json]`
// - Uses same keystore layout as your existing keys-cli.ts (compatible with saveKeypairForKeyId()).
// - Exit codes: 0=ok, 1=input error, 2=keystore/key error, 3=signing error, 4=io error.

import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import path from 'node:path';

import { defaultStoreRoot } from '../utils/keystore.js';
import { signVector } from '../lib/signVector.js';
import { resolvePrivateKeyPath } from '../utils/keystore-resolve.js';

type Args = {
  in: string;
  out: string;
  keyId: string;
  store?: string;
  meta?: string;
  json?: boolean;
};

function printJson(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2));
  process.stdout.write('\n');
}

export const sealCmd: CommandModule<unknown, Args> = {
  command: 'seal',
  describe: 'Seal (sign) a canonical vector JSON using an Ed25519 key from the keystore',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('in', { type: 'string', demandOption: true, desc: 'Input vector JSON path' })
        .option('out', { type: 'string', demandOption: true, desc: 'Output sealed JSON path' })
        .option('keyId', { type: 'string', demandOption: true, desc: 'Logical key identifier (matches keys generate --keyId)' })
        .option('store', { type: 'string', default: defaultStoreRoot(), desc: 'Keystore root directory' })
        .option('meta', { type: 'string', desc: 'Optional JSON file with extra metadata (object with primitive values)' })
        .option('json', { type: 'boolean', default: false, desc: 'JSON output' })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: async (argv: ArgumentsCamelCase<Args>) => {
    try {
      const inPath = path.resolve(argv.in);
      const outPath = path.resolve(argv.out);
      const storeRoot = typeof argv.store === 'string' ? argv.store : defaultStoreRoot();
      const keyId = argv.keyId;

      // 1) Load vector
      if (!fs.existsSync(inPath)) {
        const msg = `Input not found: ${inPath}`;
        if (argv.json) printJson({ ok: false, code: 1, error: msg }); else console.error(`❌ ${msg}`);
        process.exitCode = 1; return;
      }
      const vectorRaw = await fsp.readFile(inPath, 'utf8');
      const vector: unknown = JSON.parse(vectorRaw);

      // 2) Optional meta
      let meta: Record<string, string | number | boolean> | undefined;
      if (argv.meta) {
        const metaPath = path.resolve(argv.meta);
        if (!fs.existsSync(metaPath)) {
          const msg = `Meta file not found: ${metaPath}`;
          if (argv.json) printJson({ ok: false, code: 1, error: msg }); else console.error(`❌ ${msg}`);
          process.exitCode = 1; return;
        }
        const metaRaw = await fsp.readFile(metaPath, 'utf8');
        const parsed = JSON.parse(metaRaw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          meta = parsed as Record<string, string | number | boolean>;
        } else {
          const msg = 'Meta must be a JSON object (primitive values only)';
          if (argv.json) printJson({ ok: false, code: 1, error: msg }); else console.error(`❌ ${msg}`);
          process.exitCode = 1; return;
        }
      }

      // 3) Resolve and read private key
      const privatePemPath = await resolvePrivateKeyPath(storeRoot, keyId);
      if (!privatePemPath) {
        const msg = `Private key not found for keyId="${keyId}" under store="${storeRoot}"`;
        if (argv.json) printJson({ ok: false, code: 2, error: msg }); else console.error(`❌ ${msg}`);
        process.exitCode = 2; return;
      }
      const privatePem = await fsp.readFile(privatePemPath, 'utf8');

      // 4) Sign
      let sealed;
      try {
        sealed = signVector({
            vector,
            privateKeyPem: privatePem,
            kid: keyId,
            ...(meta !== undefined ? { meta } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Signing failed';
        if (argv.json) printJson({ ok: false, code: 3, error: msg }); else console.error(`❌ ${msg}`);
        process.exitCode = 3; return;
      }

      // 5) Write output
      await fsp.mkdir(path.dirname(outPath), { recursive: true });
      await fsp.writeFile(outPath, JSON.stringify(sealed, null, 2) + '\n', { encoding: 'utf8' });

      if (argv.json) {
        printJson({ ok: true, code: 0, out: outPath, vectorUrn: sealed.vectorUrn, envelopeId: sealed.envelopeId, keyId });
      } else {
        console.log(`✅ Sealed vector → ${outPath}`);
        console.log(`   URN: ${sealed.vectorUrn}`);
        console.log(`   Env: ${sealed.envelopeId}`);
        console.log(`   Key: ${keyId}`);
      }
      process.exitCode = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'I/O error';
      if (argv.json) printJson({ ok: false, code: 4, error: msg }); else console.error(`❌ ${msg}`);
      process.exitCode = 4;
    }
  },
};
