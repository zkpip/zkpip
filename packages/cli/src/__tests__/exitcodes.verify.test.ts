import { runCli } from './helpers/runCli.js';
import { expectOk, expectFail, expectStdoutIncludes, expectStderrIncludes } from './helpers/assertions.js';
import { fixtures } from './helpers/paths.js';
import { describe, it } from 'vitest';


describe('CLI: verify — exit codes & stdio', () => {
    it('valid sealed vector → exit 0, success message on stdout', async () => {
        const res = await runCli({ args: ['verify', '--in', fixtures.sealedSample] });
        expectOk(res);
        expectStdoutIncludes(res, /Seal verification succeeded|ok|verified/i);
    });


    it('invalid vector → non‑zero exit, error on stderr', async () => {
        const res = await runCli({ args: ['verify', '--in', fixtures.invalidVector] });
        expectFail(res);
        expectStderrIncludes(res, /error|invalid|failed/i);
    });
});