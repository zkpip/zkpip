import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { writeFileSync } from '../utils/fs-compat.js';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Resolve paths relative to this package (packages/cli)
const __filename = fileURLToPath(import.meta.url);
const PKG_ROOT = resolve(dirname(__filename), '..', '..'); // packages/cli
const CLI_ENTRY = resolve(PKG_ROOT, 'dist', 'index.js');

function runCli(args: string[], cwd?: string): { stdout: string; code: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI_ENTRY, ...args], {
      encoding: 'utf8',
      cwd,
    });
    return { stdout, code: 0 };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { stdout: (err.stdout ?? '').toString(), code: err.status ?? 1 };
  }
}

describe('keystore e2e: generate -> sign (keystore) -> verify', () => {
  it('signs without --priv using --key-id and verifies successfully', () => {
    const work = mkdtempSync(join(tmpdir(), 'zkpip-e2e-'));
    try {
      const store = join(work, 'keys'); // temp keystore root
      const keyId = 'zkpip:e2e:test';
      const manifestPath = join(work, 'm.json');
      const signedPath = join(work, 'm.signed.json');

      // minimal manifest
      writeFileSync(
        manifestPath,
        JSON.stringify({ name: 'e2e', version: '0.0.1' }) + '\n',
        'utf8',
      );

      // 1) keys generate
      const g = runCli(['keys', 'generate', '--alg', 'ed25519', '--keyId', keyId, '--store', store, '--json']);
      expect(g.code).toBe(0);

      // 2) manifest sign (no --priv), use --store for fallback
      const s = runCli([
        'manifest', 'sign',
        '--in', manifestPath,
        '--out', signedPath,
        '--keyId', keyId,
        '--store', store,
        '--json',
      ]);
      expect(s.code).toBe(0);
      expect(readFileSync(signedPath, 'utf8')).toContain('"signature"');

      // 3) keys show (get public PEM path)
      const sh = runCli(['keys', 'show', '--keyId', keyId, '--store', store, '--json']);
      expect(sh.code).toBe(0);
      const pubPath = JSON.parse(sh.stdout).publicPemPath as string;
      expect(pubPath.endsWith('/public.pem')).toBe(true);

      // 4) verify
      const v = runCli([
        'manifest', 'verify',
        '--in', signedPath,
        '--pub', pubPath,
        '--json', '--use-exit-codes',
      ]);
      expect(v.code).toBe(0);
      const parsed = JSON.parse(v.stdout) as { ok: boolean; reason: unknown };
      expect(parsed.ok).toBe(true);
      expect(parsed.reason).toBeNull();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
