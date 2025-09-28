// Derive a short, filesystem-friendly keyId from SPKI bytes.
// Algorithm: base32(lowercase, no padding)(sha256(spki)) → slice to desired length.
import { createHash } from 'node:crypto';

/**
 * Compute keyId from an Ed25519 SPKI DER.
 * Policy: base32lower(sha256(SPKI)) first 20 chars (no padding).
 */
export function keyIdFromSpki(spkiDer: Uint8Array): string {
  const sha = createHash('sha256').update(spkiDer).digest(); // Buffer
  const b32 = base32LowerNoPad(new Uint8Array(sha));
  return b32.slice(0, 20);
}

/** RFC4648 base32 (A–Z2–7) lowercase, no padding. */
function base32LowerNoPad(bytes: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]!;
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31]!;
  return out;
}

/** Convenience: also return hex of sha256(SPKI) for indexing. */
export function spkiSha256Hex(spkiDer: Uint8Array): string {
  return sha256Hex(spkiDer);
}

/** SHA-256 digest (hex lower). */
export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}
