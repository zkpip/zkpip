// ESM-only, strict TS. No "any".
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { join, resolve } from 'node:path';
import os from 'node:os';

export interface KeyRecord {
  keyId: string;
  dir: string;
  privatePemPath: string;
  publicPemPath: string;
  createdAt?: Date;
}

export function defaultStoreRoot(): string {
  // ~/.zkpip/keys
  return resolve(os.homedir(), '.zkpip', 'keys');
}

/** slug is a safe folder name derived from keyId, to avoid filesystem issues. */
export function slugFromKeyId(keyId: string): string {
  const h = createHash('sha256').update(keyId, 'utf8').digest('hex');
  return h.slice(0, 16); // short but unique-enough slug
}

export function pathsForKeyId(keyId: string, storeRoot?: string): KeyRecord {
  const root = storeRoot ? resolve(storeRoot) : defaultStoreRoot();
  const slug = slugFromKeyId(keyId);
  const dir = join(root, slug);
  return {
    keyId,
    dir,
    privatePemPath: join(dir, 'private.pem'),
    publicPemPath: join(dir, 'public.pem'),
  };
}

export function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export function generateEd25519Keypair(): { privatePem: string; publicPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  return { privatePem: privateKey, publicPem: publicKey };
}

export function saveKeypairForKeyId(keyId: string, storeRoot?: string, overwrite = false): KeyRecord {
  const rec = pathsForKeyId(keyId, storeRoot);
  ensureDir(rec.dir);
  if (!overwrite) {
    if (existsSync(rec.privatePemPath)) throw new Error(`Key already exists for keyId=${keyId} at ${rec.privatePemPath}`);
    if (existsSync(rec.publicPemPath)) throw new Error(`Key already exists for keyId=${keyId} at ${rec.publicPemPath}`);
  }
  const { privatePem, publicPem } = generateEd25519Keypair();
  writeFileSync(rec.privatePemPath, privatePem, { encoding: 'utf8', mode: 0o600 });
  writeFileSync(rec.publicPemPath, publicPem, { encoding: 'utf8', mode: 0o644 });
  return rec;
}

export function readPrivatePemForKeyId(keyId: string, storeRoot?: string): string {
  const rec = pathsForKeyId(keyId, storeRoot);
  if (!existsSync(rec.privatePemPath)) {
    throw new Error(`Private key not found for keyId=${keyId}. Expected at: ${rec.privatePemPath}`);
  }
  return readFileSync(rec.privatePemPath, 'utf8');
}

export function readPublicPemForKeyId(keyId: string, storeRoot?: string): string {
  const rec = pathsForKeyId(keyId, storeRoot);
  if (!existsSync(rec.publicPemPath)) {
    throw new Error(`Public key not found for keyId=${keyId}. Expected at: ${rec.publicPemPath}`);
  }
  return readFileSync(rec.publicPemPath, 'utf8');
}

export function listKeys(storeRoot?: string): KeyRecord[] {
  const root = storeRoot ? resolve(storeRoot) : defaultStoreRoot();
  if (!existsSync(root)) return [];
  const out: KeyRecord[] = [];
  for (const slug of readdirSync(root)) {
    const dir = join(root, slug);
    try {
      const priv = join(dir, 'private.pem');
      const pub = join(dir, 'public.pem');
      if (existsSync(priv) && existsSync(pub)) {
        const st = statSync(priv);
        out.push({ keyId: '(unknown: see README)', dir, privatePemPath: priv, publicPemPath: pub, createdAt: st.mtime });
      }
    } catch {
      // ignore broken entries
    }
  }
  return out;
}
