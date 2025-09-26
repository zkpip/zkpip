// packages/cli/src/__tests__/vectors.push.e2e.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaNode } from 'execa';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js');

describe('CLI: vectors push (DiskStore POC)', () => {
  it('push stores content on disk', async () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-vpush-'));
    try {
      const inPath = join(base, 'v.json');
      const storeDir = join(base, 'store');
      const id = 'urn:zkpip:vector:sha256:abc123';
      writeFileSync(inPath, JSON.stringify({ x: 1 }), 'utf8');

      const r = await execaNode(cliDist, ['vectors', 'push', '--id', id, '--in', inPath, '--base-dir', storeDir],
        { env: { ZKPIP_HARD_EXIT: '0' }, stdio: 'pipe', reject: false });

      expect(r.exitCode).toBe(0);
      // trivial check: a DiskStore kiszámítható névvel ír (._-:) → a tartalom meglesz
      const fname = join(storeDir, `${id.replace(/[^a-zA-Z0-9:._-]/g, '_')}.json`);
      const txt = readFileSync(fname, 'utf8');
      expect(JSON.parse(txt)).toEqual({ x: 1 });
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
