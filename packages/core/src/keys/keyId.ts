// Derive a short, filesystem-friendly keyId from SPKI bytes.
// Algorithm: base32(lowercase, no padding)(sha256(spki)) → slice to desired length.
import { createHash } from 'node:crypto';

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

function base32(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** Returns a stable keyId from raw SPKI bytes (default 16 chars, min 8). */
export function keyIdFromSpki(spki: Uint8Array, length: number = 16): string {
  const hash = createHash('sha256').update(spki).digest();
  const b32 = base32(hash);
  const L = Math.max(8, length);
  return b32.slice(0, L);
}
