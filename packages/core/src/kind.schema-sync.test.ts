// packages/core/src/kind.schema-sync.test.ts
import { expect, test } from 'vitest';
import sealSchema from '../schemas/mvs/seal.schema.json' with { type: 'json' };
import { KnownKinds } from './kind.js';

// ---- tiny runtime guards, no `any` ----
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}
type AnyOfElem = { readonly enum?: readonly string[] } | Record<string, unknown>;
function isAnyOfArray(x: unknown): x is ReadonlyArray<AnyOfElem> {
  return Array.isArray(x) && x.every((v) => typeof v === 'object' && v !== null);
}

function getSchemaKindEnum(schema: unknown): string[] {
  // Narrow step-by-step without `any`
  const props = (schema as { readonly properties?: unknown }).properties;
  if (!props || typeof props !== 'object') {
    throw new Error('schema.properties missing');
  }

  const kind = (props as { readonly kind?: unknown }).kind;
  if (!kind || typeof kind !== 'object') {
    throw new Error('schema.properties.kind missing');
  }

  const anyOf = (kind as { readonly anyOf?: unknown }).anyOf;
  if (!isAnyOfArray(anyOf)) {
    throw new Error('schema.properties.kind.anyOf missing/invalid');
  }

  const first = anyOf[0];
  const enumVal = (first as { readonly enum?: unknown }).enum;
  if (!isStringArray(enumVal)) {
    throw new Error('schema.properties.kind.anyOf[0].enum missing/invalid');
  }
  return enumVal;
}

test('kind.ts is in sync with seal.schema.json enum', () => {
  const enumKinds = getSchemaKindEnum(sealSchema);
  expect(new Set(enumKinds)).toEqual(new Set(KnownKinds));
});
