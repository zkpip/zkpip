/* Unit tests for snarkjs-groth16 adapter: artifacts.path, protocol guard, and verify contract.
   - Typed Vitest mocks (no `any`)
   - snarkjs-style VK/Proof shapes (vk_alpha_1 / vk_beta_2 / IC; proof pi_a/pi_b/pi_c)
   - Adapter verify returns boolean; protocol mismatch throws
*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';

// Use named imports to avoid eslint import/no-named-as-default-member warnings
import { verify as g16Verify, canHandle as g16CanHandle } from '../adapters/snarkjs-groth16.js';

/** Runtime verify signature used by the adapter. */
type VerifyGroth16 = (
  vkey: object,
  publics: ReadonlyArray<string>,
  proof: object,
) => Promise<boolean>;

/** Typed mock for the runtime verifier: <ArgsTuple, ReturnPromise> */
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
  return fsp.mkdtemp(path.join(os.tmpdir(), 'zkpip-snarkjs-g16-'));
}
async function writeJson(p: string, data: unknown): Promise<void> {
  await fsp.writeFile(p, JSON.stringify(data), 'utf8');
}

// Minimal-yet-realistic snarkjs Groth16 verification key & proof
const VK_SNARKJS = {
  protocol: 'groth16',
  curve: 'bn128',
  nPublic: 1,
  vk_alpha_1: ['1', '2', '1'],
  vk_beta_2: [
    ['1', '1'],
    ['1', '1'],
    ['1', '0'],
  ],
  vk_gamma_2: [
    ['1', '1'],
    ['1', '1'],
    ['1', '0'],
  ],
  vk_delta_2: [
    ['1', '1'],
    ['1', '1'],
    ['1', '0'],
  ],
  IC: [
    ['1', '2', '1'], // [0]
    ['3', '4', '1'], // [1] -> publics len = 1
  ],
} as const;

const PROOF_SNARKJS = {
  pi_a: ['1', '2', '1'],
  pi_b: [
    ['1', '1'],
    ['1', '1'],
    ['1', '0'],
  ],
  pi_c: ['1', '1', '1'],
  protocol: 'groth16',
  curve: 'bn128',
} as const;

// --- tests ------------------------------------------------------------------

describe('adapter: snarkjs-groth16', () => {
  beforeEach(() => {
    verifySpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canHandle: true for bundle and artifacts.path; false for meta-only', async () => {
    // meta-only should be false
    expect(g16CanHandle({})).toBe(false);
    expect(g16CanHandle({ proofSystem: 'groth16' })).toBe(false);

    // bundle with actual triplet
    const okBundle = {
      bundle: {
        verificationKey: VK_SNARKJS,
        proof: PROOF_SNARKJS,
        publicSignals: ['33'],
      },
    };
    expect(g16CanHandle(okBundle)).toBe(true);

    // artifacts.path directory with files
    const dir = await tmpDir();
    await writeJson(path.join(dir, 'verification_key.json'), VK_SNARKJS);
    await writeJson(path.join(dir, 'proof.json'), PROOF_SNARKJS);
    await writeJson(path.join(dir, 'public.json'), ['33']);
    expect(g16CanHandle({ artifacts: { path: dir } })).toBe(true);
  });

  it('verify → true when runtime returns true (bundle)', async () => {
    verifySpy.mockResolvedValue(true);

    const ok = await g16Verify({
      bundle: {
        verificationKey: VK_SNARKJS,
        proof: PROOF_SNARKJS,
        publicSignals: ['33'],
      },
    });
    expect(ok).toBe(true);

    expect(verifySpy).toHaveBeenCalledTimes(1);
    const [vkArg, publicsArg, proofArg] = verifySpy.mock.calls[0] as [
      unknown,
      readonly string[],
      unknown,
    ];
    expect(publicsArg.every((s: string) => typeof s === 'string')).toBe(true);
    expect(typeof vkArg).toBe('object');
    expect(Array.isArray(publicsArg)).toBe(true);
    expect(typeof proofArg).toBe('object');
  });

  it('verify → true with artifacts.path directory', async () => {
    verifySpy.mockResolvedValue(true);

    const dir = await tmpDir();
    await writeJson(path.join(dir, 'verification_key.json'), VK_SNARKJS);
    await writeJson(path.join(dir, 'proof.json'), PROOF_SNARKJS);
    await writeJson(path.join(dir, 'public.json'), ['33']);

    const ok = await g16Verify({ artifacts: { path: dir } });
    expect(ok).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('verify → false when runtime returns false', async () => {
    verifySpy.mockResolvedValue(false);

    const ok = await g16Verify({
      bundle: {
        verificationKey: VK_SNARKJS,
        proof: PROOF_SNARKJS,
        publicSignals: ['33'],
      },
    });
    expect(ok).toBe(false);
  });

  it('verify → throws on protocol mismatch (protocol !== groth16)', async () => {
    verifySpy.mockResolvedValue(true); // would pass, but guard should throw

    await expect(async () => {
      await g16Verify({
        bundle: {
          verificationKey: { ...VK_SNARKJS, protocol: 'plonk' as const },
          proof: PROOF_SNARKJS,
          publicSignals: ['33'],
        },
      });
    }).rejects.toThrow(/protocol mismatch/i);

    expect(verifySpy).not.toHaveBeenCalled();
  });
});
