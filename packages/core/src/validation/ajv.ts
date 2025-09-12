// packages/core/src/validation/ajv.ts
import { createAjv as createAjvFactory } from './createAjv.js';

export type AjvLike = ReturnType<typeof createAjvFactory>;

export function createAjv(): AjvLike {
  return createAjvFactory();
}

export type AjvInstance = ReturnType<typeof createAjv>;
