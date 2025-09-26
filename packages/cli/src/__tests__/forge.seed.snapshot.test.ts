import { describe, it, expect } from 'vitest';
import { execaNode } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { scrubForSnapshot } from '../utils/scrubForSnapshot.js';
import { isJson, type Json } from '../utils/canonical.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js');

async function runForgeOnce(seedHex: string): Promise<unknown> {
  const { stdout } = await execaNode(
    cliDist,
    ['forge', '--dry-run', '--seed', seedHex, '--json'],
    { env: { ZKPIP_HARD_EXIT: '0' }, stdio: 'pipe' }
  );
  const parsed = JSON.parse(stdout) as { ok?: boolean; result?: unknown };
  return parsed.result ?? parsed;
}

describe('forge --seed produces deterministic snapshot', () => {
  it('scrubbed outputs are byte-equal across repeated runs with the same seed', async () => {
    const aRaw = await runForgeOnce('0x1234');
    const bRaw = await runForgeOnce('0x1234');

    if (!isJson(aRaw) || !isJson(bRaw)) {
      throw new Error('forge --dry-run did not return JSON payload');
    }
    const a: Json = aRaw;
    const b: Json = bRaw;

    expect(JSON.stringify(scrubForSnapshot(a))).toEqual(
      JSON.stringify(scrubForSnapshot(b))
    );
  });
});
