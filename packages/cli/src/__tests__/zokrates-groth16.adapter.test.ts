/* Unit tests for zokrates-groth16 adapter: artifacts, shape assert, verify contract.
   - Uses typed Vitest mocks (no `any`)
   - Uses ZoKrates-native VK/Proof shapes (alpha/beta/gamma/delta + gamma_abc; proof a/b/c)
*/

import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { zokratesGroth16 } from '../adapters/zokrates-groth16.js';

// --- typed mock for snarkjs groth16.verify ---------------------------------

type VerifyGroth16 = (
  vkey: object,
  publics: ReadonlyArray<string>,
  proof: object,
) => Promise<boolean>;

const verifySpy = vi.fn<VerifyGroth16>();

vi.mock('../adapters/snarkjsRuntime.js', () => ({
  getGroth16Verify: async (): Promise<VerifyGroth16> => verifySpy,
}));

// --- helpers ----------------------------------------------------------------

async function tmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'zkpip-zo-'));
}
async function writeJson(p: string, data: unknown) {
  await fsp.writeFile(p, JSON.stringify(data), 'utf8');
}

// ZoKrates-native Groth16 verification key & proof.
// gamma_abc length must equal publics.length + 1.

const VK_ZO = {
  protocol: 'groth16',
  alpha: { x: '5', y: '6' }, // G1
  beta: { x: ['7', '8'], y: ['9', '10'] }, // G2
  gamma: { x: ['11', '12'], y: ['13', '14'] }, // G2
  delta: { x: ['15', '16'], y: ['17', '18'] }, // G2
  gamma_abc: [
    { x: '1', y: '2' }, // [0]
    { x: '3', y: '4' }, // [1] -> publics len = 1
  ],
} as const;

const PROOF_ZO = {
  a: { x: '19', y: '20' }, // G1
  b: { x: ['21', '22'], y: ['23', '24'] }, // G2
  c: { x: '25', y: '26' }, // G1
} as const;

// --- tests ------------------------------------------------------------------

describe('adapter: zokrates-groth16', () => {
  beforeEach(() => verifySpy.mockReset());

  it('verify → ok with artifacts.{path}', async () => {
    verifySpy.mockResolvedValue(true);

    const dir = await tmpDir();
    const vk = path.join(dir, 'vk.json');
    const pf = path.join(dir, 'pf.json');
    const pub = path.join(dir, 'pub.json');

    // Files to be loaded via artifacts.{path}
    await writeJson(vk, VK_ZO);
    await writeJson(pf, PROOF_ZO); // allow nested { proof: {a,b,c} }
    await writeJson(pub, ['0x01']); // publics len = 1 -> gamma_abc len must be 2 (OK)

    const inlineArtifacts = {
      artifacts: {
        verificationKey: { path: vk },
        proof: { path: pf },
        publicSignals: { path: pub },
      },
    };

    const out = await zokratesGroth16.verify(inlineArtifacts);
    expect(out.ok).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);

    const [vkeyArg, publicsArg, proofArg] = verifySpy.mock.calls[0] as Parameters<VerifyGroth16>;
    expect(typeof vkeyArg).toBe('object');
    expect(Array.isArray(publicsArg)).toBe(true);
    expect(typeof proofArg).toBe('object');
    expect(publicsArg.every((x) => typeof x === 'string')).toBe(true);
  });

  it('verify → adapter_error when gamma_abc length mismatch (blocks verify call)', async () => {
    verifySpy.mockResolvedValue(true); // should not be reached

    const VK_BAD = {
      ...VK_ZO,
      // publics len = 1 but gamma_abc has only 1 entry (should be 2)
      gamma_abc: [{ x: '1', y: '2' }],
    };

    const bad = await zokratesGroth16.verify({
      verificationKey: VK_BAD,
      publicSignals: ['0x01'],
      proof: PROOF_ZO,
    });

    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('adapter_error');
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('verify → verification_failed when provider returns false', async () => {
    verifySpy.mockResolvedValue(false);

    const out = await zokratesGroth16.verify({
      verificationKey: VK_ZO,
      publicSignals: ['0x01'],
      proof: PROOF_ZO,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('verification_failed');
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });
});
