import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import type { ValidateFunction, ErrorObject } from 'ajv';
import { makeAjv } from '../validation/ajv.js';
import { resolveSchemasDir } from './utils/resolveSchemasDir.js';

describe('each schema is valid JSON Schema (draft-2020-12)', () => {
  it('validates all schemas against the official 2020-12 meta-schema via getSchema()', () => {
    const ajv = makeAjv();
    const meta = ajv.getSchema('https://json-schema.org/draft/2020-12/schema');
    if (!meta) throw new Error('Meta-schema validator not found');
    const metaValidate: ValidateFunction<unknown> = meta;

    const dir = resolveSchemasDir();
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const invalid: Array<{ file: string; errors: ErrorObject[] | null | undefined }> = [];

    for (const f of files) {
      const schemaRaw: unknown = JSON.parse(readFileSync(`${dir}/${f}`, 'utf-8'));
      const ok = metaValidate(schemaRaw);
      if (!ok) invalid.push({ file: f, errors: metaValidate.errors });
    }

    if (invalid.length > 0) {
      const msg =
        'Invalid schemas detected:\n' +
        invalid
          .map(
            ({ file, errors }) =>
              `- ${file}\n  Errors: ${JSON.stringify(errors, null, 2)}`
          )
          .join('\n');
      throw new Error(msg);
    }

    expect(true).toBe(true);
  });

  it('rejects a deliberately invalid schema (canary)', () => {
    const ajv = makeAjv();
    const meta = ajv.getSchema('https://json-schema.org/draft/2020-12/schema');
    if (!meta) throw new Error('Meta-schema validator not found');
    const metaValidate: ValidateFunction<unknown> = meta;

    const bogusSchema: unknown = { type: 123 }; // invalid meta-schema-wise
    expect(metaValidate(bogusSchema)).toBe(false);
  });
});
