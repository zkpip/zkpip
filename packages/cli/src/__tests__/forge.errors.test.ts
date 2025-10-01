import { execaNode } from 'execa';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExitCode } from '../utils/exit.js';

const CLI = resolve(__dirname, '../../dist/index.js');

describe('zkpip forge - error handling', () => {
  it('missing --in should fail', async () => {
    const r = await execaNode(CLI, ['forge'], { reject: false });
    expect(r.exitCode).toBe(ExitCode.INVALID_ARGS);
    expect(r.stderr).toContain('FORGE_ERROR'); // JSON error code from runForgeCli
  });
});
