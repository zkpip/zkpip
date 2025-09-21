import type { CommandModule } from 'yargs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { normalizeJsonStable, type CanonicalInput } from '../utils/envelope.js';
import { vectorUrnFromCanonical } from './convert.js';

type SealArgs = { in: string; out: string };
type VerifyArgs = { in: string };

const KEY_DIR = resolve(process.cwd(), '.zkpip');
const KEY_PATH = resolve(KEY_DIR, 'key.pem');

async function ensureKey(): Promise<Buffer> {
  try {
    return await readFile(KEY_PATH);
  } catch {
    await mkdir(KEY_DIR, { recursive: true });
    const kp = generateKeyPairSync('ed25519');
    const pem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }) as Buffer;
    await writeFile(KEY_PATH, pem, 'utf8');
    return pem;
  }
}

export const vectorsSignCmd: CommandModule<unknown, SealArgs> = {
  command: 'vectors sign',
  describe: 'Dev Seal: sign a canonical vector with local ed25519 key',
  builder: (y) => y.option('in', { type: 'string', demandOption: true }).option('out', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const raw = await readFile(resolve(argv.in), 'utf8');
    const canonical = JSON.parse(raw) as CanonicalInput;
    const id = vectorUrnFromCanonical(canonical);
    const stable = normalizeJsonStable(canonical);
    const priv = await ensureKey();

    const sig = sign(null, Buffer.from(stable, 'utf8'), { key: priv });
    const pub = createPublicKey(priv).export({ type: 'spki', format: 'pem' }).toString('utf8');

    const out = {
      id,
      canonical,
      seal: {
        type: 'dev-seal-ed25519',
        signer: 'local',
        publicKey: pub,
        createdAt: new Date().toISOString(),
        signatureBase64: sig.toString('base64')
      }
    };
    await writeFile(resolve(argv.out), normalizeJsonStable(out) + '\n', 'utf8');
  },
};

export const vectorsVerifySealCmd: CommandModule<unknown, VerifyArgs> = {
  command: 'vectors verify-seal',
  describe: 'Verify a dev-seal (ed25519)',
  builder: (y) => y.option('in', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const raw = await readFile(resolve(argv.in), 'utf8');
    const obj = JSON.parse(raw) as {
      id: string; canonical: CanonicalInput; seal: { publicKey: string; signatureBase64: string };
    };
    const stable = normalizeJsonStable(obj.canonical);
    const ok = verify(null, Buffer.from(stable, 'utf8'), { key: obj.seal.publicKey }, Buffer.from(obj.seal.signatureBase64, 'base64'));
    process.stdout.write(JSON.stringify({ ok, id: obj.id }) + '\n');
    process.exitCode = ok ? 0 : 1;
  },
};
