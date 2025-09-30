// packages/cli/src/commands/manifest/sign.ts
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';

import { signManifest } from '@zkpip/core';
import type { ManifestSignature, ZkpipManifest } from '@zkpip/core';

import { readUtf8Checked, resolvePath, ensureParentDir } from '../../utils/fs.js';
import { defaultStoreRoot } from '../../utils/keystore.js';
import { resolvePrivateKeyPath } from '../../utils/keystore-resolve.js';

interface Args {
  in: string;
  out: string;
  keyId: string;
  priv?: string;
  json?: boolean;
  createOutDir?: boolean;
  append?: boolean;
  store?: string;
}

export const manifestSignCmd: CommandModule<unknown, Args> = {
  command: 'sign',
  describe: 'Sign a manifest JSON with Ed25519 (M1/A)',
  builder: (y) =>
    (
      y
        .option('in',    { type: 'string', demandOption: true,  desc: 'Input manifest JSON path' })
        .option('out',   { type: 'string', demandOption: true,  desc: 'Output manifest JSON path' })
        .option('keyId', { type: 'string', demandOption: true,  desc: 'Signature keyId to embed (also keystore lookup key)' })
        .alias('keyId', 'key-id')

        // --priv opcionális → ha nincs, keystore lookup (--key-id, --store)
        .option('priv',  { type: 'string', demandOption: false, desc: 'Private key PEM (PKCS#8) path; if omitted, keystore is used by --key-id' })

        .option('json',  { type: 'boolean', default: false,     desc: 'JSON structured CLI output' })

        .option('createOutDir', { type: 'boolean', default: false, desc: 'Create parent dir for --out if missing' })
        .alias('createOutDir', 'mkdirs')

        .option('append', { type: 'boolean', default: false,   desc: 'Append signature to signatures[] (convert from single if needed)' })
        .option('store',  { type: 'string',  demandOption: false, desc: 'Keystore root (defaults to ~/.zkpip/keys)' })

        .strictOptions()
    ) as Argv<Args>,
  handler: async (argv: ArgumentsCamelCase<Args>) => {
    const inPath  = resolvePath(argv.in);
    const outPath = resolvePath(argv.out);

    const storeRoot = argv.store ? resolvePath(argv.store) : defaultStoreRoot();
    const privPath  = typeof argv.priv === 'string' ? resolvePath(argv.priv) : undefined;

    try {
      // 1) Input manifest beolvasása
      const manifest: ZkpipManifest = JSON.parse(readUtf8Checked(inPath));

      // 2) Out dir biztosítása (ha kérték)
      ensureParentDir(outPath, argv.createOutDir === true);

      // 3) Private key PEM feloldása
      let privatePem: string;
      if (privPath) {
        // explicit --priv
        privatePem = readUtf8Checked(privPath);
      } else {
        // keystore lookup --key-id alapján
        const pemPath = await resolvePrivateKeyPath(storeRoot, argv.keyId);
        if (!pemPath) {
          const msg = `Private key not found for keyId="${argv.keyId}" under "${storeRoot}"`;
          if (argv.json) {
            process.stderr.write(JSON.stringify({ ok: false, code: 2, stage: 'keystore', error: 'KEY_NOT_FOUND', message: msg }) + '\n');
          } else {
            console.error(`❌ ${msg}`);
          }
          process.exitCode = 2;
          return;
        }
        privatePem = await readFile(pemPath, 'utf8');
      }

      // 4) Aláírás
      const { hash, signature } = signManifest({
        manifest,
        privateKeyPem: privatePem,
        keyId: argv.keyId,
      });

      // 5) Korábbi signature-k összegyűjtése
      const prior: ManifestSignature[] = [];
      if (manifest.signature) prior.push(manifest.signature);
      if (Array.isArray(manifest.signatures)) prior.push(...manifest.signatures);

      // 6) Legacy mezők kiszedése
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signature: _oldSingle, signatures: _oldMulti, ...rest } = manifest;

      // 7) Kimeneti manifest összeállítása
      const outManifest: ZkpipManifest =
        (argv as { append?: boolean }).append === true
          ? { ...rest, hash, signatures: [...prior, signature] }
          : { ...rest, hash, signature };

      // 8) Kiírás
      writeFileSync(outPath, JSON.stringify(outManifest, null, 2) + '\n', 'utf8');

      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: true, alg: signature.alg, keyId: signature.keyId, out: outPath }) + '\n');
      } else {
        console.log(`✅ Signed manifest → ${outPath}  [alg=${signature.alg}, keyId=${signature.keyId}]`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during manifest signing';
      const errorBody =
        err && typeof err === 'object' && 'code' in err
          ? { code: (err as { code: string }).code }
          : {};
      if (argv.json) {
        process.stderr.write(JSON.stringify({ ok: false, code: 1, stage: 'io', message, ...errorBody }) + '\n');
      } else {
        console.error(`❌ ${message}`);
      }
      process.exitCode = 1;
    }
  },
};
