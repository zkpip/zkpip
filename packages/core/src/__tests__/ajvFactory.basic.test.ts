// packages/core/src/__tests__/ajvFactory.basic.test.ts
import { describe, it, expect } from 'vitest';
import { createAjv } from '../validation/createAjv.js';

describe('Ajv factory', () => {
  it('compiles and validates with formats', () => {
    const ajv = createAjv();

    const s1 = { type: 'object', properties: { x: { type: 'integer' } }, required: ['x'] };
    const v1 = ajv.compile<{ x: number }>(s1);
    expect(v1({ x: 1 })).toBe(true);
    expect(v1({})).toBe(false);

    const s2 = { type: 'string', format: 'email' };
    const v2 = ajv.compile<string>(s2);
    expect(v2('user@example.com')).toBe(true);
    expect(v2('nope')).toBe(false);
  });
});
