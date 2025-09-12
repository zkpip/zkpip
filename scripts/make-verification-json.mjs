#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const [k, v] = s.split('=');
    return [k.replace(/^--/, ''), v];
  }),
);

const { in: input, out, framework, proofSystem } = args;
if (!input || !out || !framework || !proofSystem) {
  console.error(
    'Usage: node scripts/make-verification-json.mjs --framework snarkjs --proofSystem plonk --in <bundle.json> --out <verification.json>',
  );
  process.exit(1);
}

const b = JSON.parse(readFileSync(input, 'utf8'));
const verification = {
  framework,
  proofSystem,
  artifacts: {
    proof: b.proof,
    public: b.public,
    verification_key: b.verification_key,
  },
};

writeFileSync(out, JSON.stringify(verification));
console.error(`Wrote ${out}`);
