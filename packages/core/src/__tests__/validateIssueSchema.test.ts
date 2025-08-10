// packages/core/src/__tests__/validateIssueSchema.test.ts
import { describe, it, expect } from 'vitest';
import type { ValidateFunction } from 'ajv';
import { makeAjv } from '../validation/ajv.js';

describe('issue.schema.json', () => {
  const ajv = makeAjv();
  const schemaId = 'https://zkpip.org/schemas/issue.schema.json';

  // get the typed validator without using `any`
  const maybeValidator = ajv.getSchema(schemaId);
  if (!maybeValidator) {
    throw new Error(`Issue schema validator not found for $id: ${schemaId}`);
  }
  const validate: ValidateFunction<unknown> = maybeValidator;

  it('accepts a valid GitHub-sourced issue with labels and confidence', () => {
    const data = {
      id: 'iss-001',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'github',
      url: 'https://github.com/org/repo/issues/42',
      title: 'Verifier produces inconsistent outputs across platforms',
      labels: ['verifier', 'cross-platform'],
      classification: 'proof-verification',
      confidence: 0.92
    };
    expect(validate(data)).toBe(true);
  });

  it('rejects when confidence is outside the allowed [0..1] range', () => {
    const data: unknown = {
      id: 'iss-002',
      createdAt: '2025-08-10T10:45:00.000Z',
      source: 'discussion',
      url: 'https://forum.example.org/t/zk-topic/1234',
      title: 'Edge case in witness generation',
      confidence: 1.5
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects invalid URL and unknown source', () => {
    const data: unknown = {
      id: 'iss-003',
      createdAt: '2025-08-10T10:50:00.000Z',
      source: 'reddit', // not in enum
      url: 'not-a-url',
      title: 'Title ok'
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects when a required field (title) is missing', () => {
    const data: unknown = {
      id: 'iss-004',
      createdAt: '2025-08-10T10:55:00.000Z',
      source: 'github',
      url: 'https://github.com/org/repo/issues/7'
      // title is missing
    };
    expect(validate(data)).toBe(false);
  });

  it('accepts a minimal valid issue object', () => {
    const data = {
      id: 'iss-005',
      createdAt: '2025-08-10T11:00:00.000Z',
      source: 'github',
      url: 'https://github.com/org/repo/issues/100',
      title: 'Witness generation fails under specific constraints'
    };
    expect(validate(data)).toBe(true);
  });
});
