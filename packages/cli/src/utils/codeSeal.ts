// CodeSeal (ed25519) utilities – ESM, strict TS, no "any".
import { generateKeyPairSync, sign as signRaw, verify as verifyRaw } from 'node:crypto';
import * as fs from 'node:fs';
import { join } from 'node:path';

export type CodeSeal = Readonly<{
  id: string;        // canonical hash hex
  urn: string;       // urn:zkpip:vector:sha256:<hex>
  signer: string;    // e.g. "codeseal-local-ed25519"
  timestamp: string; // ISO
  signature: string; // base64
  algo: 'ed25519';
}>;

export function ensureCodeSealKeypair(dir: string): { privateKeyPem: string; publicKeyPem: string } {
  const priv = join(dir, 'ed25519_priv.pem');
  const pub  = join(dir, 'ed25519_pub.pem');
  if (!fs.existsSync(priv) || !fs.existsSync(pub)) {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(priv, privateKey.export({ format: 'pem', type: 'pkcs8' }));
    fs.writeFileSync(pub, publicKey.export({ format: 'pem', type: 'spki' }));
  }
  return {
    privateKeyPem: fs.readFileSync(priv, 'utf8'),
    publicKeyPem: fs.readFileSync(pub,  'utf8'),
  };
}

export function signCodeSeal(canonical: string, privateKeyPem: string): string {
  const sig = signRaw(null, Buffer.from(canonical, 'utf8'), privateKeyPem);
  return sig.toString('base64');
}

export function verifyCodeSeal(canonical: string, signatureB64: string, publicKeyPem: string): boolean {
  return verifyRaw(null, Buffer.from(canonical, 'utf8'), publicKeyPem, Buffer.from(signatureB64, 'base64'));
}
