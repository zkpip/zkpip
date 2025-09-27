import { describe, expect, it } from 'vitest';
import { canonicalize, stableStringify, sha256Hex, toVectorUrn, type JsonValue } from '../c14n.js';

// Deterministic C14N tests
// - English comments, strict types, no `any`

describe('c14n', () => {
  it('sorts object keys lexicographically', () => {
    const v: JsonValue = { b: 1, a: 2 };
    expect(canonicalize(v)).toBe('{"a":2,"b":1}');
  });

  it('preserves array order', () => {
    const v: JsonValue = { a: [3, 2, 1] };
    expect(canonicalize(v)).toBe('{"a":[3,2,1]}');
  });

  it('handles nested objects deterministically', () => {
    const v: JsonValue = { z: { b: 1, a: 2 }, a: { y: 0 } };
    expect(canonicalize(v)).toBe('{"a":{"y":0},"z":{"a":2,"b":1}}');
  });

  it('throws on cycles', () => {
    const x: Record<string, unknown> = {};
    // create a reference cycle without using `any` or ts-expect-error
    x.self = x;
    expect(() => canonicalize(x as unknown as JsonValue)).toThrowError('CYCLE_NOT_SUPPORTED');
  });

  it('throws if undefined sneaks in at runtime', () => {
    const v = { a: 1, b: undefined } as unknown as JsonValue;
    expect(() => canonicalize(v)).toThrowError('UNDEFINED_VALUE_AT_KEY:b');
  });

  it('rejects unsupported function/symbol at runtime', () => {
    const v = { a: 1, 
      b: ((): void => { /* noop */ }) as unknown } as unknown as JsonValue;
    expect(() => canonicalize(v)).toThrowError('UNSUPPORTED_TYPE_AT_KEY:b');
  });

  it('stableStringify is an alias of canonicalize', () => {
    const v: JsonValue = { b: 1, a: 2 };
    expect(stableStringify(v)).toBe(canonicalize(v));
  });

  it('sha256Hex + toVectorUrn are consistent for a known canonical string', () => {
    const canon = '{"a":2,"b":1}';
    const hex = sha256Hex(canon);
    expect(hex).toBe('d3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772');
    const urn = toVectorUrn(hex);
    expect(urn).toBe('urn:zkpip:vector:sha256:d3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772');
  });
});
