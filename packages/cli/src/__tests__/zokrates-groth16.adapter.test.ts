/* Unit tests for zokrates-groth16 adapter: artifacts.path, structural guards, and verify contract.
   - Typed Vitest mocks (no `any`)
   - ZoKrates-native VK/Proof shapes (alpha/beta/gamma/delta + gamma_abc; proof a/b/c)
   - Adapter verify returns boolean; protocol/shape mismatches throw
*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';

// Use named imports to avoid eslint import/no-named-as-default-member warnings
import { verify as zoVerify, canHandle as zoCanHandle } from '../adapters/zokrates-groth16.js';

/** Runtime verify signature used by the adapter. */
type VerifyGroth16 = (
  vkey: object,
  publics: ReadonlyArray<string>,
  proof: object,
) => Promise<boolean>;

/** Typed mock for the runtime verifier (shared across tests). */
const verifySpy =
  vi.fn<(vk: unknown, publics: readonly string[], proof: unknown) => Promise<boolean>>();

vi.mock('../adapters/snarkjsRuntime.js', () => ({
  getGroth16Verify: async (): Promise<VerifyGroth16> => verifySpy as unknown as VerifyGroth16,
}));

/** No-op dump to avoid filesystem writes during unit tests. Also export stringifyPublics for adapter import. */
function stringifyPublics(values: readonly unknown[]): readonly string[] {
  return values.map((v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'bigint') return v.toString(10);
    try {
      const s = (v as { toString?: () => string } | null)?.toString?.();
      if (s && s !== '[object Object]') return String(s);
    } catch {
      /* noop */
    }
    return JSON.stringify(v);
  });
}
vi.mock('../utils/dumpNormalized.js', () => ({
  dumpNormalized: async (): Promise<void> => {},
  stringifyPublics,
}));

// --- helpers ----------------------------------------------------------------

async function tmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'zkpip-zo-'));
}
async function writeJson(p: string, data: unknown): Promise<void> {
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
  beforeEach(() => {
    verifySpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canHandle: true only for realistic inputs (bundle/artifacts.path)', async () => {
    expect(zoCanHandle({})).toBe(false);
    expect(zoCanHandle({ proofSystem: 'groth16' })).toBe(false);

    const okBundle = {
      bundle: {
        verificationKey: VK_ZO,
        proof: PROOF_ZO,
        publicSignals: ['0x01'],
      },
    };
    expect(zoCanHandle(okBundle)).toBe(true);

    const dir = await tmpDir();
    await writeJson(path.join(dir, 'verification_key.json'), VK_ZO);
    await writeJson(path.join(dir, 'proof.json'), PROOF_ZO);
    await writeJson(path.join(dir, 'public.json'), ['0x01']);
    expect(zoCanHandle({ artifacts: { path: dir } })).toBe(true);
  });

  it('verify → true with artifacts.path directory (reads vk/proof/public)', async () => {
    verifySpy.mockResolvedValue(true);

    const dir = await tmpDir();
    await writeJson(path.join(dir, 'verification_key.json'), VK_ZO);
    await writeJson(path.join(dir, 'proof.json'), PROOF_ZO);
    await writeJson(path.join(dir, 'public.json'), ['0x01']); // publics length = 1 ⇒ gamma_abc must be 2 (OK)

    const ok = await zoVerify({ artifacts: { path: dir } });
    expect(ok).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);

    const [vkArg, publicsArg, proofArg] = verifySpy.mock.calls[0] as [
      unknown,
      readonly string[],
      unknown,
    ];

    expect(Array.isArray(publicsArg)).toBe(true);
    expect(publicsArg.every((s: string) => typeof s === 'string')).toBe(true);
    expect(typeof vkArg).toBe('object');
    expect(typeof proofArg).toBe('object');
  });

  it('verify → throws when gamma_abc length mismatches publics (guard blocks runtime call)', async () => {
    verifySpy.mockResolvedValue(true); // should not be called if guard works

    const VK_BAD = {
      ...VK_ZO,
      gamma_abc: [{ x: '1', y: '2' }], // publics len = 1 but gamma_abc = 1 (should be 2)
    };

    await expect(async () => {
      await zoVerify({
        verificationKey: VK_BAD,
        publicSignals: ['0x01'],
        proof: PROOF_ZO,
      });
    }).rejects.toThrow(/gamma_abc length mismatch/i);

    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('verify → soft warns when gamma_abc length mismatches publics (still calls runtime)', async () => {
    // külön spy injektálva az adapternek (nem a globális verifySpy)
    const runtimeSpy = vi.fn<
      (vk: unknown, publics: readonly string[], proof: unknown) => Promise<boolean>
    >(async () => false);

    await expect(
      zoVerify(
        {
          verificationKey: {
            // deliberately inconsistent vk (IC len != nPublic+1)
          } as unknown as object,
          publics: ['1', '2'],
          proof: PROOF_ZO,
        },
        { verify: runtimeSpy },
      ),
    ).resolves.toBe(false);

    expect(runtimeSpy).toHaveBeenCalled();
  });
});
