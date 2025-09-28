// packages/core/src/schema/__tests__/validateSeal.test.ts
import { expect, test } from 'vitest';
import { validateSealJson } from '../schema/validateSeal.js';

test('rejects invalid seal', () => {
  const res = validateSealJson({}); // invalid by design
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.errors.length).toBeGreaterThan(0);
  }
});
