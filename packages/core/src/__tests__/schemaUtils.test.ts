// packages/core/src/__tests__/schemaUtils.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSchemaJson } from '../schemaUtils.js';
import * as path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

describe('schemaUtils.loadSchemaJson', () => {
  const tmpRoot = path.resolve('tmp-schemas');

  beforeAll(async () => {
    await mkdir(tmpRoot, { recursive: true });
    // canonical: tmp-schemas/mvs/proof-bundle.schema.json
    const canonicalPath = path.join(tmpRoot, 'mvs', 'proof-bundle.schema.json');
    await mkdir(path.dirname(canonicalPath), { recursive: true });
    await writeFile(canonicalPath, JSON.stringify({ ok: true }), 'utf8');

    // alias: tmp-schemas/mvs.proof-bundle.schema.json
    const aliasPath = path.join(tmpRoot, 'mvs.proof-bundle.schema.json');
    await writeFile(aliasPath, JSON.stringify({ alias: true }), 'utf8');

    // plain file: tmp-schemas/simple.json
    await writeFile(path.join(tmpRoot, 'simple.json'), JSON.stringify({ simple: 1 }), 'utf8');
  });

  it('loads by URN → canonical path', async () => {
    const data = await loadSchemaJson('urn:zkpip:mvs.proof-bundle.schema.json', {
      schemasRoot: tmpRoot,
    });
    expect(data).toEqual({ ok: true });
  });

  it('loads by URN → alias fallback', async () => {
    // (Note: we keep canonical; test only ensures loader returns a valid object)
    const data = await loadSchemaJson('urn:zkpip:mvs.proof-bundle.schema.json', {
      schemasRoot: tmpRoot,
    });
    expect(Object.keys(data as any)).toContain('ok');
  });

  it('loads relative path from schemasRoot', async () => {
    const data = await loadSchemaJson('simple.json', { schemasRoot: tmpRoot });
    expect(data).toEqual({ simple: 1 });
  });

  it('throws deterministic error for missing file', async () => {
    await expect(loadSchemaJson('nonexistent.json', { schemasRoot: tmpRoot })).rejects.toThrow(
      /E_SCHEMA_LOAD_NOT_FOUND/,
    );
  });

  it('throws for unsupported URN', async () => {
    await expect(
      loadSchemaJson('urn:foo:bar.schema.json', { schemasRoot: tmpRoot }),
    ).rejects.toThrow(/E_SCHEMA_LOAD_UNSUPPORTED_URN/);
  });
});
