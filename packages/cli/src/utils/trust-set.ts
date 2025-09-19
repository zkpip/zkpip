import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface TrustedKey {
  keyId: string;
  publicPem: string;
}
export interface TrustSet {
  keys: ReadonlyArray<TrustedKey>;
}

export class TrustSetError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TrustSetError';
  }
}

export function loadTrustSet(path: string): TrustSet {
  const abs = resolve(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    throw new TrustSetError(`Failed to read or parse trust set: ${abs}`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { keys?: unknown }).keys)) {
    throw new TrustSetError('Invalid trust set: missing "keys" array');
  }
  const keysIn = (parsed as { keys: unknown[] }).keys;
  const keys: TrustedKey[] = [];
  for (const k of keysIn) {
    if (!k || typeof k !== 'object') throw new TrustSetError('Invalid trust set entry');
    const keyId = (k as { keyId?: unknown }).keyId;
    const pem = (k as { publicPem?: unknown }).publicPem;
    const pemPath = (k as { publicPemPath?: unknown }).publicPemPath;
    if (typeof keyId !== 'string') throw new TrustSetError('Invalid trust set entry: keyId must be string');
    if (typeof pem === 'string') {
      keys.push({ keyId, publicPem: pem });
    } else if (typeof pemPath === 'string') {
      const absPem = resolve(dirname(abs), pemPath);
      keys.push({ keyId, publicPem: readFileSync(absPem, 'utf8') });
    } else {
      throw new TrustSetError('Invalid trust set entry: require publicPem or publicPemPath');
    }
  }
  return { keys };
}

export function findPublicPemByKeyId(trust: TrustSet, keyId: string): string | undefined {
  const hit = trust.keys.find((k) => k.keyId === keyId);
  return hit?.publicPem;
}
