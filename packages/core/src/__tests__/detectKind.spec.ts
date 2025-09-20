// packages/core/src/__tests__/detectKind.spec.ts
// ESM, no any. Comments in English.
import { describe, it, expect } from 'vitest';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import { detectKind } from '../validation/addCoreSchemas.js';

describe('detectKind()', () => {
  it('maps envelope tokens to proofEnvelope', () => {
    const schema = { $id: 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json' };
    expect(detectKind(schema, '.../proof-envelope.schema.json')).toBe(CANONICAL_IDS.proofEnvelope);
  });

  it('maps legacy bundle tokens to proofEnvelope', () => {
    const legacy = { $id: 'urn:zkpip:mvs:schemas:proofBundle.schema.json' };
    expect(detectKind(legacy, '.../proof-bundle.schema.json')).toBe(CANONICAL_IDS.proofEnvelope);
  });

  it('detects other kinds as before (verification)', () => {
    const s = { $id: 'urn:zkpip:mvs:schemas:verification.schema.json' };
    expect(detectKind(s, '.../verification.schema.json')).toBe(CANONICAL_IDS.verification);
  });

  it('returns undefined when nothing matches', () => {
    const s = { $id: 'urn:zkpip:mvs:schemas:unknown.schema.json' };
    expect(detectKind(s, '.../unknown.schema.json')).toBeUndefined();
  });
});
