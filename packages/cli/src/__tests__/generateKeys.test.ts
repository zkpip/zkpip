// ESM-only Vitest unit test (no any).
import { describe, it, expect } from 'vitest';
import { generateKeys } from '../crypto/generateKeys.js';

describe('generateKeys (ed25519)', () => {
  it('returns PEM keys and meta', () => {
    const res = generateKeys({ label: 'dev-key' });

    expect(res.meta.alg).toBe('ed25519');
    expect(res.meta.kid).toMatch(/^kid-/);
    expect(new Date(res.meta.createdAt).toString()).not.toBe('Invalid Date');

    expect(res.privateKeyPem.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(res.privateKeyPem.endsWith('-----END PRIVATE KEY-----\n')).toBe(true);

    expect(res.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true);
    expect(res.publicKeyPem.endsWith('-----END PUBLIC KEY-----\n')).toBe(true);
  });
});
