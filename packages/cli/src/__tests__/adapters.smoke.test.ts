import { execaNode } from 'execa';
import { expect, test } from 'vitest';

// Helper to run CLI
async function run(args: string[]) {
  return execaNode('packages/cli/dist/index.js', args, { reject: false });
}

test('snarkjs-plonk valid → exit 0 + ok:true', async () => {
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

test('snarkjs-plonk invalid → exit 1 + verification_failed', async () => {
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

test('snarkjs-groth16 valid → exit 0', async () => {
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
  expect(JSON.parse(p.stdout).ok).toBe(true);
});

test('zokrates-groth16 valid → exit 0', async () => {
  const p = await run([
    'verify',
    '--adapter',
    'zokrates-groth16',
    '--verification',
    'fixtures/zokrates-groth16/valid/verification.json',
    '--json',
    '--use-exit-codes',
  ]);
  expect(p.exitCode).toBe(0);
  expect(JSON.parse(p.stdout).ok).toBe(true);
});
