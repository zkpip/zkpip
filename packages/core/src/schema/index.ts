// packages/core/src/schema/index.ts
import type { Options } from 'ajv';
import { createAjv } from '../validation/createAjv.js';

const options: Options = { strict: true, allErrors: true };

export const ajv = createAjv(options);

