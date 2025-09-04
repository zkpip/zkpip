// packages/core/src/__tests__/compileCoreSchemas.test.ts
import { describe, it, expect } from 'vitest';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '../index.js';
import type { ValidateFunction } from 'ajv';

/** Type guard for Ajv validate functions */
function isValidateFn(x: unknown): x is ValidateFunction {
  return typeof x === 'function';
}

describe('Core schemas compile', () => {
  it('should load and register all core schemas with canonical $id', () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    for (const id of Object.values(CANONICAL_IDS)) {
      const maybe = ajv.getSchema(id);

      expect(maybe).toBeTruthy(); // ensures defined

      if (!isValidateFn(maybe)) {
        throw new Error(`Schema is not a validate function: ${id}`);
      }

      // At this point TypeScript knows it's a function
      expect(typeof maybe).toBe('function');
    }
  });
});
