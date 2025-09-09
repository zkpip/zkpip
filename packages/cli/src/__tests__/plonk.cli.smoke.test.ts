/* ESM-only, no 'any', exactOptionalPropertyTypes friendly */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

function repoPaths() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cliDist = path.resolve(here, '../../dist/index.js');
  const vectors = path.resolve(
    here,
    '../../../core/schemas/tests/vectors/mvs/verification/snarkjs-plonk'
  );
  return { cliDist, vectors };
}

function runCli(args: readonly string[]) {
  const { cliDist } = repoPaths();
  const r = spawnSync(process.execPath, [cliDist, ...args], { encoding: 'utf8' });
  return {
    status: r.status ?? 255,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
}

function parseLastJsonLine(out: string): unknown {
  const line = (out.split('\n').pop() ?? '').trim();
  return JSON.parse(line) as unknown;
}

describe('CLI smoke: snarkjs-plonk', () => {
  it('valid dir → exit 0 + ok:true', () => {
    const { vectors } = repoPaths();
    const res = runCli([
      'verify', '--adapter', 'snarkjs-plonk',
      '--verification', path.join(vectors, 'valid'),
      '--json', '--use-exit-codes', '--no-schema',
    ]);
    expect(res.status).toBe(0);
    const obj = parseLastJsonLine(res.stdout) as { ok: boolean; adapter?: string };
    expect(obj.ok).toBe(true);
    expect(obj.adapter).toBe('snarkjs-plonk');
  });

  it('tampered public → exit 1 + verification_failed', () => {
    const { vectors } = repoPaths();
    const res = runCli([
      'verify', '--adapter', 'snarkjs-plonk',
      '--verification', path.join(vectors, 'invalid'),
      '--json', '--use-exit-codes', '--no-schema',
    ]);
    expect(res.status).toBe(1);
    const obj = parseLastJsonLine(res.stdout) as { ok: boolean; error?: string };
    expect(obj.ok).toBe(false);
    expect(obj.error).toBe('verification_failed');
  });

  it('broken JSON file → exit 2 + stage:"io"', () => {
    const { vectors } = repoPaths();
    const broken = path.join(vectors, 'invalid', 'broken_proof.json');
    const res = runCli([
      'verify', '--adapter', 'snarkjs-plonk',
      '--verification', broken,
      '--json', '--use-exit-codes', '--no-schema',
    ]);
    expect(res.status).toBe(2);
    const obj = parseLastJsonLine(res.stdout) as { ok: boolean; stage?: string; error?: string };
    expect(obj.ok).toBe(false);
    expect(obj.stage).toBe('io');
    expect(obj.error).toBe('adapter_error');
  });
});
