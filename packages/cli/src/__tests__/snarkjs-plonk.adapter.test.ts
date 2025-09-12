/* eslint-disable @typescript-eslint/consistent-type-imports */

// Unit tests for snarkjs-plonk adapter.
// Focus: extraction (dir/file/inline), artifact resolution, auto-normalization, and verify contract.
// We mock the snarkjs runtime to avoid heavy crypto work.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { snarkjsPlonk } from '../adapters/snarkjs-plonk.js';

type VerifyPlonk = (
  vkey: object,
  publics: ReadonlyArray<string>,
  proof: object | string,
) => Promise<boolean>;

// Mock dumpNormalized to avoid filesystem writes and to inspect payloads
const dumpCalls: Array<Record<string, unknown>> = [];
vi.mock('../utils/dumpNormalized.js', () => {
  return {
    dumpNormalized: (adapterId: string, payload: Record<string, unknown>) => {
      dumpCalls.push({ adapterId, ...payload });
    },
  };
});

// Mock snarkjs runtime: we can toggle the return value per test
const verifySpy = vi.fn<VerifyPlonk>();

vi.mock('../adapters/snarkjsRuntime.js', () => {
  return {
    getPlonkVerify: async (): Promise<VerifyPlonk> => verifySpy,
  };
});

function mkTmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'plonk-test-'));
}

function writeJson(filePath: string, data: unknown): Promise<void> {
  return fsp.writeFile(filePath, JSON.stringify(data), 'utf8');
}

describe('adapter: snarkjs-plonk', () => {
  beforeEach(() => {
    dumpCalls.length = 0;
    verifySpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canHandle detects plonk/snarkjs markers', () => {
    const obj = { proofSystem: 'plonk', framework: 'snarkjs' };
    expect(snarkjsPlonk.canHandle(obj)).toBe(true);

    const obj2 = { meta: { proofSystem: 'plonk' } };
    expect(snarkjsPlonk.canHandle(obj2)).toBe(true);

    const obj3 = { proof: '0xdeadbeef' };
    expect(snarkjsPlonk.canHandle(obj3)).toBe(true);
  });

  it('verify → ok when provider.verify returns true (inline, artifacts)', async () => {
    verifySpy.mockResolvedValue(true);

    const vkObj = { protocol: 'plonk' }; // nPublic will be injected by auto-normalizer
    const proofObj = { proof: '0xabc123' }; // will normalize to hex string
    const publics = ['0x01', '0x02']; // will coerce to decimal strings

    // Inline with artifacts-like containers (simulate { artifacts: { vkey, proof, publicSignals } })
    const inline = {
      artifacts: {
        verificationKey: vkObj,
        proof: proofObj,
        publicSignals: publics,
      },
    };

    const out = await snarkjsPlonk.verify(inline);
    expect(out.ok).toBe(true);
    expect(out.adapter).toBe('snarkjs-plonk');

    // Ensure verify was called with normalized inputs
    expect(verifySpy).toHaveBeenCalledTimes(1);

    // Option A: exactly one call → index 0
    const [vkeyArg, publicsArg, proofArg] = verifySpy.mock.calls[0] as Parameters<VerifyPlonk>;

    // Option B: if you prefer "last call" semantics (future-proof for multiple calls)
    // const [vkeyArg, publicsArg, proofArg] = verifySpy.mock.calls.at(-1)! as Parameters<VerifyPlonk>;

    // Basic shape checks
    expect(typeof vkeyArg).toBe('object');
    expect(Array.isArray(publicsArg)).toBe(true);
    expect(typeof proofArg === 'string' || typeof proofArg === 'object').toBe(true);

    // Dump captured actions should include proof:object→hex and vk:+nPublic
    const lastDump = dumpCalls.at(-1);
    expect(lastDump?.adapterId).toBe('snarkjs-plonk');
    const meta = (lastDump?.meta ?? {}) as Record<string, unknown>;
    const actions = (meta['actions'] ?? []) as ReadonlyArray<string>;
    // Not hard-failing if missing, but nice to check:
    expect(actions.some((a) => a.includes('proof:object→hex'))).toBe(true);
    expect(actions.some((a) => a.includes('vk:+nPublic'))).toBe(true);
  });

  it('verify → ok with directory input (vk/proof/publics files)', async () => {
    verifySpy.mockResolvedValue(true);

    const dir = await mkTmpDir();
    // Typical filenames accepted by extractFromDir
    await writeJson(path.join(dir, 'verification_key.json'), { protocol: 'plonk' });
    await writeJson(path.join(dir, 'proof.json'), { proof: '0xfeed' });
    await writeJson(path.join(dir, 'public.json'), ['0x0a', '0x0b']);

    const out = await snarkjsPlonk.verify(dir);
    expect(out.ok).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('verify → ok with single JSON file input (bundle style)', async () => {
    verifySpy.mockResolvedValue(true);

    const dir = await mkTmpDir();
    const file = path.join(dir, 'bundle.json');
    await writeJson(file, {
      bundle: {
        verificationKey: { protocol: 'plonk' },
        proof: { proof: '0xbeef' },
        publicSignals: ['0x01'],
      },
    });

    const out = await snarkjsPlonk.verify(file);
    expect(out.ok).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('verify → verification_failed when provider returns false', async () => {
    verifySpy.mockResolvedValue(false);

    const out = await snarkjsPlonk.verify({
      verificationKey: { protocol: 'plonk' },
      proof: '0xdead',
      publicSignals: ['0x01', '0x02'],
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toBe('verification_failed');
    }
  });

  it('verify → adapter_error on missing required fields', async () => {
    verifySpy.mockResolvedValue(true); // not reached

    const out = await snarkjsPlonk.verify({
      // missing vkey/proof/publics
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toBe('adapter_error');
      expect(out.message).toContain('Missing vkey/proof/publicSignals');
    }
  });

  it('verify → adapter_error if protocol !== plonk when present', async () => {
    verifySpy.mockResolvedValue(true); // would verify, but protocol check blocks

    const out = await snarkjsPlonk.verify({
      verificationKey: { protocol: 'groth16' },
      proof: '0x01',
      publicSignals: ['0x01'],
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toBe('adapter_error');
      expect(out.message).toContain('Unexpected protocol');
    }
  });
});
