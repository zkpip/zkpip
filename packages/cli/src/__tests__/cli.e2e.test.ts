/* eslint-disable no-console */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const bin = path.resolve(__dirname, '../../dist/bin.js');

describe('zkpip CLI (e2e) — batchseal', () => {
  it('flags WRONG_ADAPTER and passes matching bundle', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zkpip-cli-'));
    try {
      const wrong = path.join(dir, 'wrong.json');
      const ok = path.join(dir, 'ok.json');
      writeFileSync(wrong, JSON.stringify({ adapter: 'plonk', payload: {} }), 'utf8');
      writeFileSync(ok, JSON.stringify({ adapter: 'groth16', payload: {} }), 'utf8');

      const res = spawnSync(
        process.execPath,
        [bin, 'batchseal', '--adapter', 'groth16', path.join(dir, '*.json')],
        { encoding: 'utf8' }
      );

      // Help debugging if something goes sideways
      if (!res.stdout?.trim()) {
        // eslint-disable-next-line no-console
        console.error('CLI stderr:', res.stderr);
      }

      expect(res.status).toBe(1); // one WRONG_ADAPTER should trigger exit code 1
      const out = JSON.parse(res.stdout);
      expect(out.adapter).toBe('groth16');
      expect(out.total).toBe(2);
      expect(out.failed).toBe(1);
      expect(out.results.some((r: any) => r.code === 'WRONG_ADAPTER')).toBe(true);
      expect(out.results.some((r: any) => r.ok === true)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
