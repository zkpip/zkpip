// scripts/check-plonk-verify.mjs
import { readFile } from 'node:fs/promises';
import { plonk } from 'snarkjs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/check-plonk-verify.mjs <verification.json>');
  process.exit(2);
}

const v = JSON.parse(await readFile(path, 'utf8'));

const vk = v.bundle?.verification_key ?? v.verification_key ?? v.vkey;
const proof = v.bundle?.proof ?? v.proof;
const pub = v.bundle?.public ?? v.public;

try {
  const ok = await plonk.verify(vk, pub, proof);
  console.log(JSON.stringify({ ok }));
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error('snarkjs error:', e?.message ?? e);
  process.exit(3);
}
