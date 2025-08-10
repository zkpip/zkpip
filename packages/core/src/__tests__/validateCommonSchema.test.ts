// Positive & negative tests for common.schema.json using the preloaded validator.
// We rely on makeAjv() preloading schemas and retrieving the validator by $id.

import { describe, it, expect } from 'vitest';
import { makeAjv } from '../validation/ajv.js';

const COMMON_ID = 'https://zkpip.org/schemas/common.schema.json';

describe('common.schema.json (preloaded)', () => {
  it('accepts a minimal valid object', () => {
    const ajv = makeAjv();
    const validate = ajv.getSchema(COMMON_ID);
    expect(validate).toBeTypeOf('function');

    const validData = {
      id: 'example-id',                         // required string, minLength: 1
      createdAt: '2024-01-01T00:00:00Z',        // required RFC 3339 date-time
      // updatedAt is optional; include it if you want:
      // updatedAt: '2024-01-02T12:34:56Z',
    };

    const ok = validate!(validData);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error('AJV errors (unexpected):', validate!.errors);
    }
    expect(ok).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    const ajv = makeAjv();
    const validate = ajv.getSchema(COMMON_ID)!;

    const missingCreatedAt = {
      id: 'example-id',
      // createdAt is missing
    };

    expect(validate(missingCreatedAt)).toBe(false);
  });

  it('rejects when createdAt has invalid date-time format', () => {
    const ajv = makeAjv();
    const validate = ajv.getSchema(COMMON_ID)!;

    const invalidDate = {
      id: 'example-id',
      createdAt: 'not-a-date-time', // must be RFC 3339 date-time
    };

    expect(validate(invalidDate)).toBe(false);
  });
});
