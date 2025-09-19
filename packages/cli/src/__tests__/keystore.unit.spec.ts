import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  saveKeypairForKeyId,
  readPrivatePemForKeyId,
  readPublicPemForKeyId,
} from '../utils/keystore.js';

// NOTE: uses a temp store; does not touch ~/.zkpip/keys

describe('keystore utils (unit)', () => {
  it('generates and reads back ed25519 keypair', () => {
    const store = mkdtempSync(join(tmpdir(), 'zkpip-keys-'));
    try {
      const keyId = 'zkpip:test:unit';
      const rec = saveKeypairForKeyId(keyId, store, true);
      const priv = readPrivatePemForKeyId(keyId, store);
      const pub = readPublicPemForKeyId(keyId, store);

      expect(rec.privatePemPath.endsWith('/private.pem')).toBe(true);
      expect(rec.publicPemPath.endsWith('/public.pem')).toBe(true);
      expect(priv).toContain('BEGIN PRIVATE KEY');
      expect(pub).toContain('BEGIN PUBLIC KEY');
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});
