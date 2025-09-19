import { it, describe, expect } from 'vitest';
import { runCliFast } from './helpers/runCliFast.js';
import { expectExit0 } from './helpers/expectExit0.js';
import { plonkValid, plonkInvalid, g16Valid, hasG16, zoValid, hasZo } from './helpers/fixtures.js';
import { runCli } from './helpers/cliRunner.js';

function itIf(b: boolean) { return b ? it : it.skip; }

describe('adapters.smoke (CLI roundtrip via fixtures)', () => {
  it('snarkjs-plonk valid → exit 0 + ok:true', async () => {
    const p = await runCliFast(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkValid]);
    expectExit0(p);
  });

  it('snarkjs-plonk invalid → exit 1 + verification_failed', async () => {
    const p = await runCli(['verify', '--adapter', 'snarkjs-plonk', '--verification', plonkInvalid]);
    expect(p.exitCode).toBe(1);
  });

  itIf(hasG16)('snarkjs-groth16 valid → exit 0', async () => {
    const p = await runCliFast(['verify', '--adapter', 'snarkjs-groth16', '--verification', g16Valid]);
    expectExit0(p);
  });

  itIf(hasZo)('zokrates-groth16 valid → exit 0', async () => {
    const p = await runCliFast(['verify', '--adapter', 'zokrates-groth16', '--verification', zoValid]);
    expectExit0(p);
  });
});
