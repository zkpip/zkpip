import type { CommandModule, Argv, ArgumentsCamelCase } from 'yargs';
import { verifyManifest } from '@zkpip/core';
import type { ZkpipManifest } from '@zkpip/core';
import { readUtf8Checked, resolvePath } from '../../utils/fs.js';
import { loadTrustSet, findPublicPemByKeyId } from '../../utils/trust-set.js';
import { ExitCode } from '../../utils/exit.js';

interface Args {
  in: string;
  pub: string;
  trustSet?: string;
  json?: boolean;
  useExitCodes?: boolean;
}

function setExit(useExitCodes: boolean | undefined, code: ExitCode): void {
  process.exitCode = useExitCodes ? code : ExitCode.OK;
}

export const manifestVerifyCmd: CommandModule<unknown, Args> = {
  command: 'verify',
  describe: 'Verify a signed manifest (M1/A)',
  builder: (y: Argv<unknown>): Argv<Args> =>
    (
      y
        .option('in',  { type: 'string', demandOption: true, desc: 'Signed manifest JSON path' })
        .option('pub', { type: 'string', demandOption: false, desc: 'Public key PEM (SPKI) path' })
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

  // Return ExitCode; the caller/entry should set process.exitCode.
  handler: async (argv: ArgumentsCamelCase<Args>): Promise<void> => {
    const inPath = resolvePath(argv.in);
    const pubPath = typeof argv.pub === 'string' ? resolvePath(argv.pub) : undefined;
    const trustPath = typeof argv.trustSet === 'string' ? resolvePath(argv.trustSet) : undefined;

    try {
      const manifest = JSON.parse(readUtf8Checked(inPath)) as ZkpipManifest;

      // trust policy
      let trustPubPem: string | undefined;
      if (trustPath) {
        const trust = loadTrustSet(trustPath);
        const keyId = (manifest as { signature?: { keyId?: string } }).signature?.keyId;

        if (!keyId) {
          const body = { ok: false, reason: 'untrusted_key', message: 'Manifest missing signature.keyId under trust policy' };
          if (argv.json) process.stdout.write(JSON.stringify(body) + '\n');
          else console.error('❌ ' + body.message);
          setExit(argv.useExitCodes, ExitCode.VERIFY_ERROR);
          return;
        }

        trustPubPem = findPublicPemByKeyId(trust, keyId);
        if (!trustPubPem) {
          const body = { ok: false, reason: 'untrusted_key', message: `KeyId not in trust set: ${keyId}` };
          if (argv.json) process.stdout.write(JSON.stringify(body) + '\n');
          else console.error('❌ ' + body.message);
          setExit(argv.useExitCodes, ExitCode.VERIFY_ERROR);
          return;
        }
      }

      const publicPem =
        pubPath ? readUtf8Checked(pubPath) :
        trustPubPem ? trustPubPem :
        undefined;

      if (!publicPem) {
        const body = { ok: false, reason: 'io_error', message: 'No public key provided (use --pub or --trust-set).' };
        if (argv.json) process.stdout.write(JSON.stringify(body) + '\n');
        else console.error('❌ ' + body.message);
        setExit(argv.useExitCodes, ExitCode.VERIFY_ERROR);
        return;
      }

      const res = verifyManifest({ manifest, publicKeyPem: publicPem });

      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: res.ok, reason: res.reason ?? null }) + '\n');
      } else {
        console.log(res.ok ? '✅ Manifest verification OK' : `❌ Manifest verification FAILED: ${res.reason}`);
      }

      setExit(argv.useExitCodes, res.ok ? ExitCode.OK : ExitCode.VERIFY_ERROR);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during manifest verification';
      const body = { ok: false, reason: 'io_error', message };
      if (argv.json) process.stderr.write(JSON.stringify(body) + '\n');
      else console.error('❌ ' + message);
      setExit(argv.useExitCodes, ExitCode.UNEXPECTED);
    }
  }
};
