// Load pinned schema snapshot at build time to avoid drift.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadPinnedSchema(): unknown {
  const p = resolve(new URL('../../schemas/pinned-proof-envelope.schema.json', import.meta.url).pathname);
  const raw = readFileSync(p, 'utf8');
  return JSON.parse(raw) as unknown;
}
