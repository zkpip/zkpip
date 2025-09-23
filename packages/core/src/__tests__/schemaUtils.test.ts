// packages/core/src/__tests__/schemaUtils.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSchemaJson } from '../schemaUtils.js';
import * as path from 'node:path';
import { writeFile, mkdir } from '#fs-compat';

describe('schemaUtils.loadSchemaJson', () => {
  const tmpRoot = path.resolve('tmp-schemas');

  beforeAll(async () => {
    await mkdir(tmpRoot, { recursive: true });
    // canonical: tmp-schemas/mvs/proof-envelope.schema.json
    const canonicalPath = path.join(tmpRoot, 'mvs', 'proof-envelope.schema.json');
    await mkdir(path.dirname(canonicalPath), { recursive: true });
    await writeFile(canonicalPath, JSON.stringify({ ok: true }), 'utf8');

    // alias: tmp-schemas/mvs.proof-envelope.schema.json
    const aliasPath = path.join(tmpRoot, 'mvs.proof-envelope.schema.json');
    await writeFile(aliasPath, JSON.stringify({ alias: true }), 'utf8');

    // plain file: tmp-schemas/simple.json
    await writeFile(path.join(tmpRoot, 'simple.json'), JSON.stringify({ simple: 1 }), 'utf8');
  });

  it('loads by URN → canonical path', async () => {
    const data = await loadSchemaJson('urn:zkpip:mvs.proof-envelope.schema.json', {
      schemasRoot: tmpRoot,
    });
    expect(data).toEqual({ ok: true });
  });

  it('loads by URN → alias fallback', async () => {
    const data = await loadSchemaJson('urn:zkpip:mvs.proof-envelope.schema.json', {
      schemasRoot: tmpRoot,
    });

    const hasOk = (v: unknown): v is { ok: unknown } =>
      typeof v === 'object' && v !== null && 'ok' in v;

    expect(hasOk(data)).toBe(true);
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
