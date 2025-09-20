import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { verifyManifest } from '@zkpip/core';
import type { ZkpipManifest } from '@zkpip/core';
import { readUtf8Checked, resolvePath } from '../../utils/fs.js';
import { loadTrustSet, findPublicPemByKeyId } from '../../utils/trust-set.js';

interface Args {
  in: string;
  pub: string;
  trustSet?: string;
  json?: boolean;
  useExitCodes?: boolean;
}

export const manifestVerifyCmd: CommandModule<unknown, Args> = {
  command: 'verify',
  describe: 'Verify a signed manifest (M1/A)',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('in',  { type: 'string', demandOption: true, desc: 'Signed manifest JSON path' })
        .option('pub', { type: 'string', demandOption: false, desc: 'Public key PEM (SPKI) path' }) // <-- was true
        .option('trustSet', { type: 'string', demandOption: false, desc: 'Path to trusted key list JSON' })
        .alias('trustSet', 'trust-set')
        .option('json', { type: 'boolean', default: false, desc: 'JSON structured CLI output' })
        .option('useExitCodes', { type: 'boolean', default: false, desc: 'Return 0/1 based on result' })
        .alias('useExitCodes', 'use-exit-codes')
        // Require at least one of --pub or --trust-set:
        .check((argv) => {
          if (!argv.pub && !argv['trust-set'] && !argv.trustSet) {
            throw new Error('Either --pub or --trust-set must be provided.');
          }
          return true;
        })
        .strictOptions()
    ) as unknown as Argv<Args>,
  handler: (argv: ArgumentsCamelCase<Args>) => {
    const inPath = resolvePath(argv.in);
    const pubPath: string | undefined = typeof argv.pub === 'string' ? resolvePath(argv.pub) : undefined;
    const trustPath: string | undefined = typeof argv.trustSet === 'string' ? resolvePath(argv.trustSet) : undefined;

    try {
      const manifest = JSON.parse(readUtf8Checked(inPath)) as ZkpipManifest;

      // Extract keyId (manifest must be signed at this point)
      const keyId = (manifest as { signature?: { keyId?: string } }).signature?.keyId;

      // If a trust set is provided, enforce membership
      let trustPubPem: string | undefined;
      if (trustPath) {
        const trust = loadTrustSet(trustPath);
        if (!keyId) {
          // No keyId in signature → reject under trust policy
          const body = { ok: false, reason: 'untrusted_key', message: 'Manifest missing signature.keyId under trust policy' };
          if (argv.json) process.stdout.write(JSON.stringify(body) + '\n'); else console.error('❌ ' + body.message);
          if (argv.useExitCodes) process.exit(1); else { process.exitCode = 1; return; }
        }
        trustPubPem = findPublicPemByKeyId(trust, keyId);
        if (!trustPubPem) {
          const body = { ok: false, reason: 'untrusted_key', message: `KeyId not in trust set: ${keyId}` };
          if (argv.json) process.stdout.write(JSON.stringify(body) + '\n'); else console.error('❌ ' + body.message);
          if (argv.useExitCodes) process.exit(1); else { process.exitCode = 1; return; }
        }
      }

      // Choose public key for verification:
      // 1) explicit --pub wins; 2) else from trust set; 3) else error (no key available)
      const publicPem =
        pubPath ? readUtf8Checked(pubPath) :
        trustPubPem ? trustPubPem :
        undefined;

      if (!publicPem) {
        const body = { ok: false, reason: 'io_error', message: 'No public key provided (use --pub or --trust-set).' };
        if (argv.json) process.stdout.write(JSON.stringify(body) + '\n'); else console.error('❌ ' + body.message);
        if (argv.useExitCodes) process.exit(1); else { process.exitCode = 1; return; }
      }

      const res = verifyManifest({ manifest, publicKeyPem: publicPem! });

      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: res.ok, reason: res.reason ?? null }) + '\n');
      } else {
        console.log(res.ok ? '✅ Manifest verification OK' : `❌ Manifest verification FAILED: ${res.reason}`);
      }
      if (argv.useExitCodes) process.exit(res.ok ? 0 : 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during manifest verification';
      const body = { ok: false, reason: 'io_error', message };
      if (argv.json) process.stderr.write(JSON.stringify(body) + '\n'); else console.error('❌ ' + message);
      process.exitCode = 1;
      if (argv.useExitCodes) process.exit(1);
    }
  }
};
