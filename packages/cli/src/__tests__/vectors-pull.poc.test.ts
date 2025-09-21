import { execaNode } from 'execa';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CLI = resolve(__dirname, '../../dist/index.js');
const POC_URL = 'data:application/json,%7B%22hello%22%3A%22world%22%7D';
const OUT = resolve('/tmp/zkpip-pull.json');

describe('zkpip vectors pull (POC by URL)', () => {
  it('downloads file by --url', async () => {
    const r = await execaNode(CLI, ['vectors', 'pull', '--url', POC_URL, '--out', OUT]);
    expect(r.exitCode).toBe(0);
    expect(existsSync(OUT)).toBe(true);
    const content = readFileSync(OUT, 'utf8');
    expect(JSON.parse(content)).toEqual({ hello: 'world' });
  });

  it('requires either --id or --url', async () => {
    const r = await execaNode(CLI, ['vectors', 'pull', '--out', OUT], { reject: false });
    expect(r.exitCode).not.toBe(0);
  });

it('downloads from real HTTP when enabled', async () => {
  if (!process.env.ZKPIP_NETWORK_TESTS) return; // skip by default
  const REAL_URL = 'https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore';
  const r = await execaNode(CLI, ['vectors', 'pull', '--url', REAL_URL, '--out', OUT]);
  expect(r.exitCode).toBe(0);
  expect(existsSync(OUT)).toBe(true);
}, 20000);  
});