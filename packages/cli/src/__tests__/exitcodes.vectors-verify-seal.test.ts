import { runCli } from './helpers/runCli.js';
import { expectOk, expectFail, expectStdoutIncludes } from './helpers/assertions.js';
import { fixtures } from './helpers/paths.js';
import { describe, expect, it } from 'vitest';

describe('CLI: vectors verify-seal — exit codes & stdio', () => {
  it.skip('valid sealed → exit 0, success', async () => {
    const res = await runCli({
      args: [
        'vectors', 'verify-seal',
        '--in', fixtures.sealedSample,
        '--key-dir', fixtures.keyDir,
        '--json'
      ],
    });
    try {
      const payload = JSON.parse(res.stdout) as { ok: boolean };
      expect(payload.ok).toBe(true);
    } catch {
      expectStdoutIncludes(res, /ok|success|verified/i);
    }
    expectOk(res);
  });

  it('invalid sealed → non-zero', async () => {
    const res = await runCli({
      args: [
        'vectors', 'verify-seal',
        '--in', fixtures.invalidVector, 
        '--key-dir', fixtures.keyDir,
        '--json'
      ],
    });
    expectFail(res);
  });
});
