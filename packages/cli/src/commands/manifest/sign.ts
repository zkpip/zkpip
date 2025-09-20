import { writeFileSync } from 'node:fs';
import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { signManifest } from '@zkpip/core';
import type { ManifestSignature, ZkpipManifest } from '@zkpip/core';
import { readUtf8Checked, resolvePath, ensureParentDir } from '../../utils/fs.js';
import { readPrivatePemForKeyId } from '../../utils/keystore.js';

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
        .option('in',   { type: 'string', demandOption: true,  desc: 'Input manifest JSON path' })
        .option('out',  { type: 'string', demandOption: true,  desc: 'Output manifest JSON path' })
        .option('keyId',{ type: 'string', demandOption: true,  desc: 'Signature keyId to embed (also keystore lookup key)' })
        .alias('keyId', 'key-id')

        // priv is optional -> keystore fallback ha nincs megadva
        .option('priv', { type: 'string', demandOption: false, desc: 'Private key PEM (PKCS#8) path; if omitted, keystore is used by --key-id' })

        .option('json', { type: 'boolean', default: false,     desc: 'JSON structured CLI output' })

        // prefer createOutDir, de tartsunk alias-t a régi --mkdirs-re
        .option('createOutDir', { type: 'boolean', default: false, desc: 'Create parent dir for --out if missing' })
        .alias('createOutDir', 'mkdirs')

        // NEW: append to signatures[]
        .option('append', { type: 'boolean', default: false,   desc: 'Append signature to signatures[] (convert from single if needed)' })
        .option('store', { type: 'string', demandOption: false, desc: 'Keystore root (defaults to ~/.zkpip/keys)' })
        
        .strictOptions()
    ) as Argv<Args>,
  handler: (argv: ArgumentsCamelCase<Args>) => {
    // Resolve input/output to absolute paths (stable I/O regardless of CWD)
    const inPath = resolvePath(argv.in);
    const outPath = resolvePath(argv.out);

    // Optional keystore root and explicit private key path
    const store: string | undefined = argv.store;
    const privPath: string | undefined = typeof argv.priv === 'string' ? resolvePath(argv.priv) : undefined;

    try {
      // Load manifest JSON
      const manifest: ZkpipManifest = JSON.parse(readUtf8Checked(inPath));

      // Ensure parent directory for --out if requested
      ensureParentDir(outPath, argv.createOutDir === true);

      // Resolve private key PEM: prefer --priv, otherwise load from keystore by --keyId
      const privPem = privPath ? readUtf8Checked(privPath) : readPrivatePemForKeyId(argv.keyId, store);

      // Produce canonical hash + fresh signature for this keyId
      // NOTE: signManifest must canonicalize by excluding {hash, signature, signatures}
      const { hash, signature } = signManifest({
        manifest,
        privateKeyPem: privPem,
        keyId: argv.keyId,
      });

      // Gather any previous signatures into a mutable array
      const prior: ManifestSignature[] = [];
      if (manifest.signature) prior.push(manifest.signature);
      if (Array.isArray(manifest.signatures)) prior.push(...manifest.signatures);

      // Drop legacy signature fields from the base object, keep all other fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signature: _oldSingle, signatures: _oldMulti, ...rest } = manifest;

      // Build the output manifest based on --append
      const outManifest: ZkpipManifest =
        (argv as { append?: boolean }).append === true
          // append=true → persist as signatures[]
          ? { ...rest, hash, signatures: [...prior, signature] }
          // append=false → single signature only
          : { ...rest, hash, signature };

      // Persist signed manifest (pretty-printed + trailing LF for stability)
      writeFileSync(outPath, JSON.stringify(outManifest, null, 2) + '\n', 'utf8');

      if (argv.json) {
        process.stdout.write(
          JSON.stringify({ ok: true, alg: signature.alg, keyId: signature.keyId, out: outPath }) + '\n',
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`✅ Signed manifest → ${outPath}  [alg=${signature.alg}, keyId=${signature.keyId}]`);
      }
    } catch (err) {
      // Emit machine-readable error when --json, otherwise human-friendly line
      const message = err instanceof Error ? err.message : 'Unexpected error during manifest signing';
      const errorBody =
        err && typeof err === 'object' && 'code' in err
          ? { code: (err as { code: string }).code }
          : {};
      if (argv.json) {
        process.stderr.write(JSON.stringify({ ok: false, message, ...errorBody }) + '\n');
      } else {
        // eslint-disable-next-line no-console
        console.error(`❌ ${message}`);
      }
      process.exitCode = 1;
    }
  },
};
