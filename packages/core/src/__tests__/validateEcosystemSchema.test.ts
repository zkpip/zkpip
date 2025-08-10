import { describe, it, expect } from 'vitest';
import { makeAjv } from '../validation/ajv.js';

describe('ecosystem.schema.json (negative cases)', () => {
  const ajv = makeAjv();
  const validate = ajv.getSchema('https://zkpip.org/schemas/ecosystem.schema.json')!;

  it('rejects missing required field: project', () => {
    const data = {
      id: 'no-project',
      createdAt: '2025-08-10T10:00:00.000Z',
      zkTech: 'zk-rollup',
      description: 'Valid length description, but project is missing.',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects project shorter than minLength (2)', () => {
    const data = {
      id: 'short-project',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'A',
      zkTech: 'plonk',
      description: 'Description long enough to pass.',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects description shorter than minLength (10)', () => {
    const data = {
      id: 'short-desc',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'Valid Name',
      zkTech: 'halo2',
      description: 'too short',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects invalid website URI', () => {
    const data = {
      id: 'bad-website',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'Valid Project',
      zkTech: 'groth16',
      website: 'not-a-uri',
      description: 'Sufficiently long description value.',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects languages when not an array of strings', () => {
    const data = {
      id: 'bad-languages',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'Valid Project',
      zkTech: 'circom',
      description: 'Long description content.',
      languages: [123, 'TypeScript'], // invalid: number in items
    } as any;
    expect(validate(data)).toBe(false);
  });
});
