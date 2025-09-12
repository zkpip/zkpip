import { execaNode } from 'execa';
import { expect, test } from 'vitest';

const bin = 'packages/cli/dist/index.js';

async function run(args: string[]) {
  return execaNode(bin, args, { reject: false });
}

test('plonk valid → exit 0 + ok:true', async () => {
  const p = await run([
    'verify',
    '--adapter',
    'snarkjs-plonk',
    '--verification',
    'fixtures/snarkjs-plonk/valid/verification.json',
    '--json',
    '--use-exit-codes',
  ]);
  expect(p.exitCode).toBe(0);
  expect(JSON.parse(p.stdout)).toEqual({ ok: true, adapter: 'snarkjs-plonk' });
});

test('plonk invalid → exit 1 + verification_failed', async () => {
  const p = await run([
    'verify',
    '--adapter',
    'snarkjs-plonk',
    '--verification',
    'fixtures/snarkjs-plonk/invalid/verification.json',
    '--json',
    '--use-exit-codes',
  ]);
  expect(p.exitCode).toBe(1);
  const out = JSON.parse(p.stdout);
  expect(out.ok).toBe(false);
  expect(out.error).toBe('verification_failed');
});

test('groth16 valid → exit 0 + ok:true', async () => {
  const p = await run([
    'verify',
    '--adapter',
    'snarkjs-groth16',
    '--verification',
    'fixtures/snarkjs-groth16/valid/verification.json',
    '--json',
    '--use-exit-codes',
  ]);
  expect(p.exitCode).toBe(0);
  expect(JSON.parse(p.stdout)).toEqual({ ok: true, adapter: 'snarkjs-groth16' });
});
