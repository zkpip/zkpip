/* eslint-disable @typescript-eslint/consistent-type-imports */

// Unit tests for snarkjs-plonk adapter (refactored contract).
// Focus: extraction (bundle/artifacts.path), normalization, protocol guard, injected verify stub.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Use named imports to avoid import/no-named-as-default-member
import { verify as plonkVerify, canHandle as plonkCanHandle } from '../adapters/snarkjs-plonk.js';

// ----- Strong types (no `any`) -----

/** Runtime verify signature used by the adapter. */
type VerifyPlonk = (
  vkey: object,
  publics: ReadonlyArray<string>,
  proof: object | string,
) => Promise<boolean>;

type DumpPhase = 'preExtract' | 'postExtract' | 'postVerify';

type DumpPayload = {
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly vkey?: unknown;
  readonly proof?: unknown;
  readonly publics?: readonly unknown[];
  readonly normalized?: {
    readonly verificationKey: unknown;
    readonly proof: unknown;
    readonly publics: readonly string[];
  };
};

// ----- Mocks -----

/** Captured dumpNormalized calls for assertions. */
const dumpCalls: Array<readonly [string, DumpPhase, DumpPayload]> = [];

/** Minimal stringifyPublics kept here to satisfy adapter imports when mocked. */
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

// Mock dumpNormalized: async, explicit (adapterId, phase, payload) signature
vi.mock('../utils/dumpNormalized.js', () => {
  return {
    dumpNormalized: async (
      adapterId: string,
      phase: DumpPhase,
      payload?: DumpPayload,
    ): Promise<void> => {
      dumpCalls.push([adapterId, phase, (payload ?? {}) as DumpPayload]);
    },
    stringifyPublics,
  };
});

// Mock snarkjs runtime: tests control the outcome via verifySpy
type VerifyPlonkArgs = [object, ReadonlyArray<string>, object | string];
type VerifyPlonkRet = Promise<boolean>;
const verifySpy = vi.fn<VerifyPlonkArgs, VerifyPlonkRet>();

vi.mock('../adapters/snarkjsRuntime.js', () => {
  return {
    getPlonkVerify: async (): Promise<VerifyPlonk> => verifySpy as unknown as VerifyPlonk,
  };
});

// ----- Helpers -----

function mkTmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'plonk-adapter-'));
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fsp.writeFile(filePath, JSON.stringify(data), 'utf8');
}

// ----- Tests -----

describe('adapter: snarkjs-plonk', () => {
  beforeEach(() => {
    dumpCalls.length = 0;
    verifySpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canHandle: true only for realistic inputs (bundle/artifacts.path)', async () => {
    // Minimal/meta-only shapes should be false
    expect(plonkCanHandle({})).toBe(false);
    expect(plonkCanHandle({ proofSystem: 'plonk' })).toBe(false);

    // Bundle-style with actual triplet
    const okBundle = {
      bundle: {
        verificationKey: { protocol: 'plonk' },
        proof: { proof: '0xabc' },
        publicSignals: ['33'],
      },
    };
    expect(plonkCanHandle(okBundle)).toBe(true);

    // artifacts.path with files
    const dir = await mkTmpDir();
    await writeJson(path.join(dir, 'verification_key.json'), { protocol: 'plonk' });
    await writeJson(path.join(dir, 'proof.json'), { proof: '0xdead' });
    await writeJson(path.join(dir, 'public.json'), ['1', '2']);
    expect(plonkCanHandle({ artifacts: { path: dir } })).toBe(true);
  });

  it('verify → true when runtime returns true (bundle)', async () => {
    verifySpy.mockResolvedValue(true);

    const input = {
      bundle: {
        verificationKey: { protocol: 'plonk' },
        proof: { proof: '0xabc123' },
        publicSignals: ['0x01', 2],
      },
    };

    const ok = await plonkVerify(input);
    expect(ok).toBe(true);

    // One call, publics normalized to string[]
    expect(verifySpy).toHaveBeenCalledTimes(1);
    const [vkArg, publicsArg, proofArg] = verifySpy.mock.calls[0]!;
    expect(typeof vkArg).toBe('object');
    expect(Array.isArray(publicsArg)).toBe(true);
    expect((publicsArg as readonly unknown[]).every((s) => typeof s === 'string')).toBe(true);
    expect(typeof proofArg === 'string' || typeof proofArg === 'object').toBe(true);

    // Dump phases present
    const phases = dumpCalls.map(([, phase]) => phase);
    expect(phases).toContain('preExtract');
    expect(phases).toContain('postExtract');
    expect(phases).toContain('postVerify');
  });

  it('verify → true with artifacts.path input (reads directory)', async () => {
    verifySpy.mockResolvedValue(true);

    const dir = await mkTmpDir();
    await writeJson(path.join(dir, 'verification_key.json'), { protocol: 'plonk' });
    await writeJson(path.join(dir, 'proof.json'), { proof: '0xfeed' });
    await writeJson(path.join(dir, 'public.json'), ['0x0a', '0x0b']);

    const ok = await plonkVerify({ artifacts: { path: dir } });
    expect(ok).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('verify → false when runtime returns false', async () => {
    verifySpy.mockResolvedValue(false);

    const ok = await plonkVerify({
      bundle: {
        verificationKey: { protocol: 'plonk' },
        proof: { proof: '0xdead' },
        publicSignals: ['11', '22'],
      },
    });

    expect(ok).toBe(false);
  });

  it('verify → throws on protocol mismatch (protocol !== plonk)', async () => {
    verifySpy.mockResolvedValue(true); // would pass, but guard should throw

    await expect(() =>
      plonkVerify({
        bundle: {
          verificationKey: { protocol: 'groth16' },
          proof: { proof: '0x01' },
          publicSignals: ['1'],
        },
      }),
    ).rejects.toThrow(/protocol mismatch/i);

    expect(verifySpy).not.toHaveBeenCalled();
  });
});
