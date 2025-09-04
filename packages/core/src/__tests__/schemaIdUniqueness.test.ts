// packages/core/src/__tests__/schemaIdUniqueness.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function getSchemasRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // src/__tests__ → (..).. → packages/core → /schemas
  return path.resolve(__dirname, '../../schemas');
}

function readJson<T = unknown>(abs: string): T {
  const txt = readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(txt) as T;
}

describe('$id uniqueness by filename (no duplicates among core schemas)', () => {
  it('should not have duplicate canonical IDs/filenames', () => {
    const names = [
      'mvs.core.schema.json',
      'mvs.ecosystem.schema.json',
      'mvs.issue.schema.json',
      'mvs.verification.schema.json',
    ];

    const dir = getSchemasRoot();

    const seenFilenames = new Set<string>();
    const seenIds = new Set<string>();

    for (const n of names) {
      expect(seenFilenames.has(n)).toBe(false);
      seenFilenames.add(n);

      const p = path.join(dir, n);
      const s = readJson<Record<string, unknown>>(p);

      expect(typeof s).toBe('object');
      expect(s).not.toBeNull();

      const id = s?.['$id'];
      if (typeof id === 'string') {
        expect(seenIds.has(id)).toBe(false);
        seenIds.add(id);
      }
    }
  });
});
