// packages/cli/src/__tests__/canonical.test.ts
import { describe, it, expect } from 'vitest';
import {
  stableStringify,
  sha256HexCanonical,
  toVectorUrn,
  type JsonObject, // ⬅️ ezt importáld
} from '../utils/canonical.js';

describe('canonical utils', () => {
  it('stableStringify orders keys recursively', () => {
    const a: JsonObject = { b: 1, a: { d: 2, c: 3 } as JsonObject };
    const b: JsonObject = { a: { c: 3, d: 2 } as JsonObject, b: 1 };
    expect(stableStringify(a)).toEqual(stableStringify(b));
  });

  it('sha256HexCanonical is insensitive to key order', () => {
    const a: JsonObject = { z: 1, a: 2 };
    const b: JsonObject = { a: 2, z: 1 };
    expect(sha256HexCanonical(a)).toEqual(sha256HexCanonical(b)); // ✅ típushiba megszűnik
  });

  it('toVectorUrn formats URN properly', () => {
    const urn = toVectorUrn('deadbeef');
    expect(urn).toBe('urn:zkpip:vector:sha256:deadbeef');
  });
});
