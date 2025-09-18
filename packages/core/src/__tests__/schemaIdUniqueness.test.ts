// packages/core/src/__tests__/schemaIdUniqueness.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
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

/** Resolve schema file path from logical name, supporting both layouts:
 *  - flat:   packages/core/schemas/mvs.<name>.schema.json
 *  - folder: packages/core/schemas/mvs/<name>.schema.json
 */
function resolveSchemaPath(dir: string, name: string): string {
  const flat = path.join(dir, `mvs.${name}.schema.json`);
  const folder = path.join(dir, 'mvs', `${name}.schema.json`);
  if (existsSync(flat)) return flat;
  if (existsSync(folder)) return folder;
  throw new Error(`Schema file not found for name="${name}"\n  tried:\n  - ${flat}\n  - ${folder}`);
}

/** Canonicalize $id so dotted vs colon styles won’t collide in the set. */
function canonicalIdKey(id: string): string {
  return id.replace(/^urn:zkpip:mvs:/, 'urn:zkpip:mvs.');
}

describe('$id uniqueness by filename (no duplicates among core schemas)', () => {
  it('should not have duplicate canonical IDs/filenames', () => {
    // Add new schemas here as logical names (no "mvs." prefix, no ".schema.json" suffix).
    const names = [
      'core',
      'ecosystem',
      'issue',
      'verification',
      'proofEnvelope', // NEW
    ];

    const dir = getSchemasRoot();

    const seenFilenames = new Set<string>();
    const seenIds = new Set<string>();

    for (const name of names) {
      const p = resolveSchemaPath(dir, name);

      // Ensure we don’t list the same physical file twice
      const rel = path.relative(dir, p);
      expect(seenFilenames.has(rel)).toBe(false);
      seenFilenames.add(rel);

      const s = readJson<Record<string, unknown>>(p);
      expect(typeof s).toBe('object');
      expect(s).not.toBeNull();

      const id = s?.['$id'];
      if (typeof id === 'string') {
        const key = canonicalIdKey(id);
        expect(seenIds.has(key)).toBe(false);
        seenIds.add(key);

        // Optional: assert conventional pattern
        // expect(key).toMatch(/^urn:zkpip:mvs\.[a-zA-Z0-9]+\.schema\.json$/);
      } else {
        throw new Error(`Missing $id in schema file: ${rel}`);
      }
    }
  });
});
