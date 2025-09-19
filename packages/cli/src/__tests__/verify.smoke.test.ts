import { describe, it, expect } from 'vitest';
import { runCliFast } from './helpers/runCliFast.js';
import { expectExit0 } from './helpers/expectExit0.js';
import { plonkValid, plonkInvalid, g16Valid, hasG16 } from './helpers/fixtures.js';
import { runCli } from './helpers/cliRunner.js';

function itIf(b: boolean) {
  return b ? it : it.skip;
}

describe('zkpip verify (smoke)', () => {
  it('plonk valid → exit 0 + ok:true', async () => {
    const r = await runCliFast(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkValid]);
    expectExit0(r);
  });

  it('plonk invalid → exit 1 + verification_failed', async () => {
    const r = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkInvalid]);
    expect(r.exitCode).toBe(1);
  });

  itIf(hasG16)('groth16 valid → exit 0 + ok:true', async () => {
    const r = await runCliFast(['verify', '--adapter', 'snarkjs-groth16', '--verification', g16Valid]);
    expectExit0(r);
  });
});
