import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk upward from this util's directory and return the first existing schemas directory.
 * At each level it tries both "<dir>/schemas" and "<dir>/src/schemas".
 */
export function resolveSchemasDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  const tried: string[] = [];

  for (let i = 0; i < 10; i++) {
    const candidates = [resolve(dir, 'schemas'), resolve(dir, 'src/schemas')];
    for (const c of candidates) {
      tried.push(c);
      if (existsSync(c)) return c;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  throw new Error(`Schemas directory not found. Tried:\n${tried.join('\n')}`);
}
