// scripts/spec/dev-keygen.ts
// ESM; strict TS; no "any". Prints base64url seed (d) and public (x).
import { randomBytes, createPrivateKey } from 'node:crypto';

function b64u(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function pkcs8FromSeed(seed: Uint8Array): Buffer {
  if (seed.length !== 32) throw new Error('seed must be 32 bytes');
  const header = Buffer.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ]);
  return Buffer.concat([header, Buffer.from(seed)]);
}
async function main(): Promise<void> {
  const seed = randomBytes(32);
  const d = b64u(seed);
  const pkcs8 = pkcs8FromSeed(seed);
  const keyObj = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const jwk = keyObj.export({ format: 'jwk' }) as { x?: string };
  const x = jwk.x ?? '';
  console.log('--- .env snippet ---');
  console.log(`ZKPIP_DEV_ED25519_SK_B64URL=${d}`);
  console.log('--- keys.jwks snippet ---');
  console.log(
    JSON.stringify(
      {
        keys: [{ kty: 'OKP', crv: 'Ed25519', kid: 'dev-1', x }],
      },
      null,
      2,
    ),
  );
}
await main();
