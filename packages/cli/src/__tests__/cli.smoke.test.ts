import { describe, it, expect } from 'vitest';

// Modules to import; adjust if your filenames differ.
// Using `satisfies` ensures this stays a readonly string array.
const commandModules = [
  '../commands/verify.ts',
  '../commands/validate.ts',
  '../commands/vectors-validate.ts',
] as const satisfies ReadonlyArray<string>;

/** Narrow unknown to a plain object record without using `any`. */
function isObjectRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** If `key` exists on `obj`, assert its typeof is `typeName`. */
function expectOptionalType(
  obj: Readonly<Record<string, unknown>>,
  key: string,
  typeName: 'string' | 'function' | 'object' | 'boolean' | 'number',
): void {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    const val = obj[key];
    // Note: typeof null === 'object' in JS; this is fine for a smoke check.
    expect(typeof val).toBe(typeName);
  }
}

describe('CLI smoke tests (command modules importable)', () => {
  for (const rel of commandModules) {
    it(`imports ${rel}`, async () => {
      // Dynamic import keeps ESM compatibility under Vitest
      const mod = await import(rel);

      // Basic sanity checks
      expect(isObjectRecord(mod)).toBe(true);

      // command, builder, handler, describe/aliases
      const obj = mod as Record<string, unknown>;
      expectOptionalType(obj, 'command', 'string');
      expectOptionalType(obj, 'describe', 'string');
      expectOptionalType(obj, 'aliases', 'object'); // arrays are 'object' by typeof
      expectOptionalType(obj, 'builder', 'function');
      expectOptionalType(obj, 'handler', 'function');
    });
  }
});
