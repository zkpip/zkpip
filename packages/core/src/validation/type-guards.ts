// packages/core/src/validation/type-guards.ts
export function isSchemaObject(x: unknown): x is { $id?: string } & Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}