import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolveSchemasDir } from './utils/resolveSchemasDir.js';
import { isObject } from './utils/typeGuards.js';

describe('$id uniqueness across all schemas', () => {
  it('ensures each schema has a non-empty $id and that all $id values are unique', () => {
    const dir = resolveSchemasDir();
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

    const ids = new Set<string>();
    const duplicates: string[] = [];
    const missingId: string[] = [];

    for (const f of files) {
      const raw: unknown = JSON.parse(readFileSync(`${dir}/${f}`, 'utf-8'));
      if (!isObject(raw)) {
        missingId.push(f);
        continue;
      }
      const id = typeof raw.$id === 'string' ? raw.$id : undefined;

      if (!id || id.trim().length === 0) {
        missingId.push(f);
        continue;
      }
      if (ids.has(id)) duplicates.push(`${f} → ${id}`);
      else ids.add(id);
    }

    if (missingId.length || duplicates.length) {
      const details = [
        missingId.length ? `Missing $id in: ${missingId.join(', ')}` : null,
        duplicates.length ? `Duplicate $id:\n- ${duplicates.join('\n- ')}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      throw new Error(details);
    }

    expect(true).toBe(true);
  });
});
