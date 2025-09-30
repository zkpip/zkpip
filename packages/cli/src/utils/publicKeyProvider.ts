import * as fs from 'node:fs';
import { defaultStoreRoot } from '../utils/keystore.js';
import { locatePublicByKeyId } from '../utils/keystore-lookup.js';
import type { PublicKeyProvider } from '@zkpip/core';

export function fsPublicKeyProvider(rootDir?: string): PublicKeyProvider {
  const base = rootDir ?? defaultStoreRoot();
  return (keyId: string): string | null => {
    const found = locatePublicByKeyId(base, keyId);
    if (!found) return null;
    return fs.readFileSync(found.publicPemPath, 'utf8');
  };
}
