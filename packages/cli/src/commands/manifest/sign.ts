// packages/cli/src/commands/manifest/sign.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandModule, Argv } from 'yargs';
import { signManifest } from '@zkpip/core';
import type { ZkpipManifest } from '@zkpip/core';

interface Args {
  in: string;
  out: string;
  priv: string;
  keyId: string;
  json?: boolean;
}

export const manifestSignCmd: CommandModule<unknown, Args> = {
  command: 'sign',
  describe: 'Sign a manifest JSON with Ed25519 (M1/A)',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('in',   { type: 'string', demandOption: true, desc: 'Input manifest JSON path' })
        .option('out',  { type: 'string', demandOption: true, desc: 'Output manifest JSON path' })
        .option('priv', { type: 'string', demandOption: true, desc: 'Private key PEM (PKCS#8) path' })
        .option('keyId', { type: 'string', demandOption: true, desc: 'Signature keyId to embed' })
        .alias('keyId', 'key-id')
        .option('json', { type: 'boolean', default: false, desc: 'JSON structured CLI output' })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv) => {
    const inPath = resolve(argv.in);
    const outPath = resolve(argv.out);
    const privPem = readFileSync(resolve(argv.priv), 'utf8');
    const manifest = JSON.parse(readFileSync(inPath, 'utf8')) as ZkpipManifest;

    const { hash, signature } = signManifest({ manifest, privateKeyPem: privPem, keyId: argv.keyId });
    const signed = { ...manifest, hash, signature };
    writeFileSync(outPath, `${JSON.stringify(signed, null, 2)}\n`, 'utf8');

    if (argv.json) {
      process.stdout.write(JSON.stringify({ ok: true, alg: signature.alg, keyId: signature.keyId, out: outPath }) + '\n');
    } else {
      // eslint-disable-next-line no-console
      console.log(`✅ Signed manifest → ${outPath}  [alg=${signature.alg}, keyId=${signature.keyId}]`);
    }
  },
};
