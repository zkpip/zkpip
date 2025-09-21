import { execaNode } from 'execa';
import { resolve } from 'node:path';
import { existsSync, readdirSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CLI = resolve(__dirname, '../../dist/index.js');
const VALID_DIR = resolve(__dirname, '../../../core/schemas/tests/vectors/mvs/verification/snarkjs-groth16/valid');
const OUT_OK = resolve('/tmp/zkpip-forge.valid.json');
const OUT_BAD_DIR = resolve('/tmp/zkpip-invalids');

function clearDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

describe('zkpip forge e2e', () => {

  it('writes invalid samples that verify rejects', async () => {
    clearDir(OUT_BAD_DIR);

    const r = await execaNode(CLI, [
      'forge', '--in', VALID_DIR, '--adapter', 'snarkjs-groth16',
      '--out', OUT_OK, '--invalid-out', OUT_BAD_DIR, '--pretty',
    ]);
    expect(r.exitCode).toBe(0);

    const all = readdirSync(OUT_BAD_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => resolve(OUT_BAD_DIR, f))
      .filter((p) => { try { return statSync(p).isFile(); } catch { return false; } })
      .filter((p) => /proof-envelope\.invalid\..+\.json$/.test(p));

    expect(all.length).toBeGreaterThanOrEqual(2);

    for (const p of all) {
      expect(existsSync(p)).toBe(true);
      const v = await execaNode(
        CLI,
        ['verify', '--adapter', 'snarkjs-groth16', '--verification', p, '--json', '--use-exit-codes'],
        { reject: false },
      );
      if (v.exitCode === 0) {
        // eslint-disable-next-line no-console
        console.log('Invalid sample unexpectedly accepted:', p);
      }
      expect(v.exitCode).not.toBe(0);
    }
  }, 20000);
});
