import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { signManifest } from '@zkpip/core';
import type { ZkpipManifest } from '@zkpip/core';
import { readUtf8Checked, resolvePath, ensureParentDir } from '../../utils/fs.js';
import { readPrivatePemForKeyId } from '../../utils/keystore.js';

interface Args {
  in: string;
  out: string;
  priv: string;
  keyId: string;
  json?: boolean;
  createOutDir?: boolean; // new
}

export const manifestSignCmd: CommandModule<unknown, Args> = {
  command: 'sign',
  describe: 'Sign a manifest JSON with Ed25519 (M1/A)',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('in',   { type: 'string', demandOption: true, desc: 'Input manifest JSON path' })
        .option('out',  { type: 'string', demandOption: true, desc: 'Output manifest JSON path' })
        .option('priv', { type: 'string', demandOption: false, desc: 'Private key PEM (PKCS#8) path; if omitted, keystore is used' })
        .option('keyId', { type: 'string', demandOption: true, desc: 'Signature keyId to embed (also keystore lookup key)' })
        .alias('keyId', 'key-id')
        .option('store', { type: 'string', demandOption: false, desc: 'Keystore root (defaults to ~/.zkpip/keys)' })
        .option('json', { type: 'boolean', default: false, desc: 'JSON structured CLI output' })
        .option('createOutDir', { type: 'boolean', default: false, desc: 'Create parent dir for --out if missing' })
        .alias('createOutDir', 'mkdirs')
        .check((argv) => {
          // enforce: priv OR keystore via keyId must be usable (keyId anyway required)
          if (!argv.priv && !argv.keyId) throw new Error('Either --priv must be provided, or a valid --key-id for keystore lookup.');
          return true;
        })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv: ArgumentsCamelCase<Args>) => {
    const inPath = resolvePath(argv.in);
    const outPath = resolvePath(argv.out);

    const store: string | undefined = typeof argv.store === 'string' ? argv.store : undefined;
    const privPath: string | undefined = typeof argv.priv === 'string' ? resolvePath(argv.priv) : undefined;

    try {
      const manifest = JSON.parse(readUtf8Checked(inPath)) as ZkpipManifest;
      ensureParentDir(outPath, argv.createOutDir === true);

      const privPem = privPath
        ? readUtf8Checked(privPath)
        : readPrivatePemForKeyId(argv.keyId, store);

      const { hash, signature } = signManifest({
        manifest,
        privateKeyPem: privPem,
        keyId: argv.keyId,
      });
      const signed = { ...manifest, hash, signature };
      writeFileSync(outPath, `${JSON.stringify(signed, null, 2)}\n`, 'utf8');

      if (argv.json) {
        process.stdout.write(
          JSON.stringify({ ok: true, alg: signature.alg, keyId: signature.keyId, out: outPath }) + '\n',
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`✅ Signed manifest → ${outPath}  [alg=${signature.alg}, keyId=${signature.keyId}]`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error during manifest signing';
      const errorBody =
        err && typeof err === 'object' && 'code' in err
          ? { code: (err as { code: string }).code }
          : {};
      if (argv.json) {
        process.stderr.write(
          JSON.stringify({ ok: false, message, ...errorBody }) + '\n',
        );
      } else {
        // eslint-disable-next-line no-console
        console.error(`❌ ${message}`);
      }
      process.exitCode = 1;
    }
  },
};
