// packages/cli/src/utils/dumpNormalized.ts
// ESM-only, strict TS, no "any"
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type DumpMeta = Readonly<Record<string, string | number | boolean>>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [k: string]: JsonValue };
// accept both mutable and readonly arrays
export type JsonArray = Array<JsonValue> | ReadonlyArray<JsonValue>;

export function dumpNormalized(
  adapterId: string,
  payload: {
    vkey?: Record<string, unknown>;
    proof?: unknown;
    publics?: ReadonlyArray<string>;
    meta?: Record<string, JsonValue>;
  },
): void {
  const dirFromEnv = process.env.ZKPIP_DUMP_NORMALIZED;
  if (!dirFromEnv) return;

  const dir = resolve(dirFromEnv);
  const ts = Date.now().toString();
  const id = adapterId.replace(/[^a-z0-9._-]/gi, '_'); // sanitize

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return; // ignore fs errors silently
  }

  const write = (name: string, data: unknown): void => {
    try {
      writeFileSync(join(dir, `${name}.${id}.${ts}.json`), JSON.stringify(data, null, 2), 'utf8');
    } catch {
      /* ignore */
    }
  };

  // keep legacy separate files
  if (payload.vkey) write('vk', payload.vkey);
  if (payload.proof) write('proof', payload.proof);
  if (payload.publics) write('publics', payload.publics);
  if (payload.meta) write('meta', payload.meta);

  // NEW: combined normalized.*.json if we have any of the normalized fields
  if (payload.vkey || payload.proof || (payload.publics && payload.publics.length > 0)) {
    const normalized = {
      ...(payload.vkey ? { vkey: payload.vkey } : {}),
      ...(payload.proof ? { proof: payload.proof } : {}),
      ...(payload.publics ? { publics: payload.publics } : {}),
    } as const;
    write('normalized', normalized);
  }
}
