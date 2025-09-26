import { describe, it, expect, beforeAll } from 'vitest';
import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolvePrivateKeyPath, resolvePublicKeyPath } from '../utils/keystore-resolve.js';

async function mkfile(p: string, data: string): Promise<void> {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, data, 'utf8');
}

describe('keystore-resolve', () => {
  const root = path.join(os.tmpdir(), `zkpip-ks-${Date.now()}`);

  beforeAll(async () => {
    // layout: ~/.zkpip/keys/<random>/private.pem, public.pem, key.meta.json
    const kid = 'dev1';
    const folder = path.join(root, 'cf4b9c1f5eb31deb');
    await mkfile(path.join(folder, 'private.pem'), '---PRIVATE---');
    await mkfile(path.join(folder, 'public.pem'),  '---PUBLIC---');
    await mkfile(path.join(folder, 'key.meta.json'), JSON.stringify({ kid }, null, 2) + '\n');
  });

  it('resolves by meta kid', async () => {
    const priv = await resolvePrivateKeyPath(root, 'dev1');
    const pub = await resolvePublicKeyPath(root, 'dev1');
    expect(priv && fs.existsSync(priv)).toBe(true);
    expect(pub && fs.existsSync(pub)).toBe(true);
  });

  it('returns null for unknown keyId', async () => {
    const priv = await resolvePrivateKeyPath(root, 'missing');
    expect(priv).toBeNull();
  });
});
