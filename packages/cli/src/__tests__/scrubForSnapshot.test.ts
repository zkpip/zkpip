import { describe, it, expect } from 'vitest';
import { scrubForSnapshot } from '../utils/scrubForSnapshot.js';

describe('scrubForSnapshot', () => {
  it('removes non-deterministic fields recursively', () => {
    const a = {
      envelopeId: 'X',
      timestamp: '2025-09-25T00:00:00Z',
      nested: { createdAt: 'now', value: 123, arr: [{ updatedAt: 't', ok: true }] }
    };
    const b = {
      envelopeId: 'Y',
      timestamp: '2025-01-01T00:00:00Z',
      nested: { createdAt: 'later', value: 123, arr: [{ updatedAt: 'x', ok: true }] }
    };
    expect(scrubForSnapshot(a)).toEqual(scrubForSnapshot(b));
  });
});
