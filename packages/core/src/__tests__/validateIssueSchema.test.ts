import { describe, it, expect } from 'vitest';
import { makeAjv } from '../validation/ajv.js';

describe('issue.schema.json (negative cases)', () => {
  const ajv = makeAjv();
  const validate = ajv.getSchema('https://zkpip.org/schemas/issue.schema.json')!;

  it('rejects missing required field: source', () => {
    const data = {
      id: 'iss-missing-source',
      createdAt: '2025-08-10T10:40:00.000Z',
      url: 'https://github.com/org/repo/issues/42',
      title: 'Title present',
    } as any;
    expect(validate(data)).toBe(false);
  });

  it('rejects unknown source enum value', () => {
    const data = {
      id: 'iss-bad-source',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'reddit', // not allowed
      url: 'https://github.com/org/repo/issues/101',
      title: 'Unsupported source value',
    } as any;
    expect(validate(data)).toBe(false);
  });

  it('rejects invalid URL format', () => {
    const data = {
      id: 'iss-bad-url',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'github',
      url: 'not-a-url',
      title: 'Bad url format',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects title shorter than minLength (3)', () => {
    const data = {
      id: 'iss-short-title',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'gitlab',
      url: 'https://gitlab.com/org/repo/-/issues/5',
      title: 'Hi', // too short
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects confidence below 0 or above 1', () => {
    const below = {
      id: 'iss-conf-below',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'discussion',
      url: 'https://forum.example.org/t/zk-topic/1234',
      title: 'Confidence too low',
      confidence: -0.1,
    } as any;
    const above = {
      id: 'iss-conf-above',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'stack-overflow',
      url: 'https://stackoverflow.com/questions/12345',
      title: 'Confidence too high',
      confidence: 1.01,
    } as any;

    expect(validate(below)).toBe(false);
    expect(validate(above)).toBe(false);
  });

  it('rejects labels when not an array of strings', () => {
    const data = {
      id: 'iss-bad-labels',
      createdAt: '2025-08-10T10:40:00.000Z',
      source: 'github',
      url: 'https://github.com/org/repo/issues/77',
      title: 'Labels contain a non-string',
      labels: ['a', 2, 'c'], // invalid number in items
    } as any;
    expect(validate(data)).toBe(false);
  });
});
