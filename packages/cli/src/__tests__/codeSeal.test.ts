import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureCodeSealKeypair, signCodeSeal, verifyCodeSeal } from '../utils/codeSeal.js';

describe('CodeSeal ed25519', () => {
  it('signs and verifies canonical content using a temp key dir', () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-cs-'));
    try {
      const { privateKeyPem, publicKeyPem } = ensureCodeSealKeypair(base);
      const canonical = '{"a":1,"b":2}';
      const sig = signCodeSeal(canonical, privateKeyPem);
      expect(sig.length).toBeGreaterThan(16);
      expect(verifyCodeSeal(canonical, sig, publicKeyPem)).toBe(true);
      expect(verifyCodeSeal('{"a":1,"b":3}', sig, publicKeyPem)).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
