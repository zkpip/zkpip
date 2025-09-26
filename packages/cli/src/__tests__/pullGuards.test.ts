import { describe, it, expect } from 'vitest';
// fontos: a FORRÁS TS-t importáljuk
import { normalizeSourceUri } from '../utils/pullGuards.ts';

describe('pullGuards', () => {
  it('normalizeSourceUri allows absolute file:// only and rejects traversal', () => {
    expect(() => normalizeSourceUri('file://relative/path', true)).toThrow(/absolute|host/i);
    expect(() => normalizeSourceUri('file:///etc/passwd', true)).not.toThrow();

    // raw traversal
    expect(() => normalizeSourceUri('file:///tmp/../etc/passwd', true)).toThrow(/traversal/i);
    // encoded traversal
    expect(() => normalizeSourceUri('file:///tmp/%2e%2e/etc/passwd', true)).toThrow(/traversal/i);
  });
});
