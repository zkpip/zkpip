// packages/cli/src/__tests__/keys.generate.e2e.test.ts
import { describe, it, expect } from 'vitest';
import { execaNode } from 'execa';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliDist = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

describe('CLI: keys generate', () => {
  it('generates keypair and writes index', async () => {
    const store = mkdtempSync(join(tmpdir(), 'zkpip-keys-'));
    const { stdout, exitCode } = await execaNode(cliDist, ['keys', 'generate', '--store', store, '--json'], {
      env: { ZKPIP_HARD_EXIT: '0' }, 
    });
    expect(exitCode).toBe(0);

    const out = JSON.parse(stdout) as { ok: true; keyId: string; dir: string };
    expect(out.ok).toBe(true);
    const keyDir = join(store, out.keyId);
    expect(existsSync(join(keyDir, 'private.pem'))).toBe(true);
    expect(existsSync(join(keyDir, 'public.pem'))).toBe(true);
    expect(existsSync(join(keyDir, 'key.json'))).toBe(true);

    const meta = JSON.parse(readFileSync(join(keyDir, 'key.json'), 'utf8'));
    expect(meta.keyId).toBe(out.keyId);
    expect(meta.algo).toBe('ed25519');

    // index should exist and reference the key
    const index = JSON.parse(readFileSync(join(store, 'keys.index.json'), 'utf8'));
    expect(index[out.keyId]).toBeTruthy();
    expect(index[out.keyId].dir).toBe(out.keyId);
  });
});
