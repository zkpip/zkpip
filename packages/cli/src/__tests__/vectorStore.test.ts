import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiskStore } from '../utils/vectorStore.js';

describe('DiskStore', () => {
  it('put/get roundtrip', async () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-vs-'));
    try {
      const store = new DiskStore(base);
      const id = 'urn:zkpip:vector:sha256:abc123';
      const content = '{"hello":"world"}';
      await store.putVector(id, content, 'application/json');
      const got = await store.getVector(id);
      expect(got).toBe(content);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
