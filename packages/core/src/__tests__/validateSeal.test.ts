// packages/core/src/schema/__tests__/validateSeal.test.ts
import { expect, test } from 'vitest';
import { validateSealV1Ajv } from '@zkpip/core/schema/validateSeal';

test('rejects invalid seal', () => {
  const res = validateSealV1Ajv({}); // invalid by design
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.errors.length).toBeGreaterThan(0);
  }
});
