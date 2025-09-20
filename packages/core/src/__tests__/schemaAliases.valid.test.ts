// packages/core/src/__tests__/schemaAliases.valid.test.ts
import { describe, it, expect } from 'vitest';
import { createAjv, addCoreSchemas } from '../index.js';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';

describe('Schema alias coverage', () => {
  it('resolves short dot, short slash, URN, https and filename aliases', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const entries: Array<[string, string[]]> = [
      [
        CANONICAL_IDS.proofEnvelope,
        [
          // legacy
          'mvs.proof-envelope',
          'mvs/proof-envelope',
          'mvs.proof-envelope.schema.json',
          // new subpath alias
          'mvs/verification/proofEnvelope',
        ],
      ],
      [CANONICAL_IDS.cir, ['mvs.cir', 'mvs/cir', 'mvs.cir.schema.json', 'mvs/verification/cir']],
      [
        CANONICAL_IDS.verification,
        ['mvs.verification', 'mvs/verification', 'mvs.verification.schema.json'],
      ],
      [CANONICAL_IDS.issue, ['mvs.issue', 'mvs/issue', 'mvs.issue.schema.json']],
      [CANONICAL_IDS.ecosystem, ['mvs.ecosystem', 'mvs/ecosystem', 'mvs.ecosystem.schema.json']],
    ];

    for (const [urn, aliases] of entries) {
      expect(ajv.getSchema(urn)).toBeTruthy();

      const tail = urn.split(':').pop()!;
      const https = `https://zkpip.org/schemas/${tail}`;
      expect(ajv.getSchema(https)).toBeTruthy();

      for (const a of aliases) {
        expect(ajv.getSchema(a)).toBeTruthy();
      }
    }
  });
});
