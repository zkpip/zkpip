import { describe, expect, it } from 'vitest';
import { canonicalize, sha256Hex, type JsonValue } from '../../json/c14n.js';

// Extra hardening tests for arrays, numbers, and unicode

describe('c14n edge cases', () => {
  it('rejects sparse arrays (holes)', () => {
    const arr = [] as unknown[];
    arr[0] = 1;
    arr[2] = 3; // hole at index 1
    const v = { a: arr } as unknown as JsonValue;
    expect(() => canonicalize(v)).toThrowError('UNDEFINED_ARRAY_HOLE_AT_INDEX:1');
  });

  it('rejects undefined inside arrays', () => {
    const v = { a: [1, undefined, 3] } as unknown as JsonValue;
    expect(() => canonicalize(v)).toThrowError('UNDEFINED_ARRAY_ENTRY_AT_INDEX:1');
  });

  it('rejects function/symbol inside arrays', () => {
    const fn = (() => {}) as unknown;
    const v = { a: [1, fn, 3] } as unknown as JsonValue;
    expect(() => canonicalize(v)).toThrowError('UNSUPPORTED_TYPE_AT_INDEX:1');
  });

  it('handles emoji and special unicode deterministically', () => {
    const v: JsonValue = { emoji: '😀', ls: '\u2028', ps: '\u2029' };
    const s = canonicalize(v);
    expect(s).toBe('{"emoji":"😀","ls":"\u2028","ps":"\u2029"}');
  });

  it('JSON.stringify behaviour on NaN/Infinity becomes null', () => {
    const v = { n1: Number.NaN, n2: Number.POSITIVE_INFINITY, n3: Number.NEGATIVE_INFINITY } as unknown as JsonValue;
    const s = canonicalize(v);
    expect(s).toBe('{"n1":null,"n2":null,"n3":null}');
  });

  it('sha256 remains stable on known canonical string', () => {
    const canon = '{"a":2,"b":1}';
    expect(sha256Hex(canon)).toBe('d3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772');
  });
});
