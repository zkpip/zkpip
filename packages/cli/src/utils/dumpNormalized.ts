// src/utils/dumpNormalized.ts
// ESM-only, strict TS, no "any". Sync writes, async signature for compatibility.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { readonly [k: string]: JsonValue } | readonly JsonValue[];

export type DumpPhase = 'preExtract' | 'postExtract' | 'postVerify';
export type DumpMeta = Readonly<Record<string, JsonValue>>;

/** Wide payload types: real artifacts vary across frameworks. */
export interface DumpPayload {
  readonly meta?: DumpMeta;

  /** Verification key (shape varies) */
  readonly vkey?: unknown;

  /** Proof object or encoded string */
  readonly proof?: unknown;

  /** Raw public inputs before stringification */
  readonly publics?: readonly unknown[];

  /** Already-normalized triplet ready to persist */
  readonly normalized?: {
    readonly verificationKey: unknown;
    readonly proof: unknown;
    readonly publics: readonly string[];
  };

  /** Optional root override; otherwise ZKPIP_DUMP_NORMALIZED is used */
  readonly dirOverride?: string;
}

/** Stable stringify of public inputs to string[], tolerant to bigint/number/mixed. */
export function stringifyPublics(values: readonly unknown[]): readonly string[] {
  return values.map((v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'bigint') return v.toString(10);
    try {
      const s = (v as { toString?: () => string } | null)?.toString?.();
      if (s && s !== '[object Object]') return String(s);
    } catch {
      /* noop */
    }
    return JSON.stringify(v);
  });
}

function writeJson(filePath: string, obj: unknown): void {
  writeFileSync(filePath, JSON.stringify(obj, null, 2), { encoding: 'utf8' });
}

/**
 * Flexible signature:
 *  - dumpNormalized(id, payload)
 *  - dumpNormalized(id, phase, payload?)
 *
 * Returns Promise<void> so callers may `await` it; internally uses sync I/O.
 */
export async function dumpNormalized(
  adapterId: string,
  phaseOrPayload?: DumpPhase | DumpPayload,
  maybePayload?: DumpPayload,
): Promise<void> {
  const isPhase = typeof phaseOrPayload === 'string';
  const phase: DumpPhase | undefined = isPhase ? (phaseOrPayload as DumpPhase) : undefined;
  const payload: DumpPayload | undefined = isPhase
    ? maybePayload
    : (phaseOrPayload as DumpPayload | undefined);

  const root = payload?.dirOverride?.trim() || process.env.ZKPIP_DUMP_NORMALIZED?.trim();
  if (!root) return;

  const absRoot = resolve(root); // normalize to absolute
  const dir = join(absRoot, adapterId);
  mkdirSync(dir, { recursive: true });

  // Always write/update meta.json
  const meta = {
    timestamp: new Date().toISOString(),
    ...(phase ? { phase } : null),
    adapterId,
    ...(payload?.meta ?? {}),
  };
  writeJson(join(dir, 'meta.json'), meta);

  // Optional artifacts (only when provided)
  if (payload?.vkey !== undefined) {
    writeJson(join(dir, 'verification_key.json'), payload.vkey);
  }
  if (payload?.proof !== undefined) {
    writeJson(join(dir, 'proof.json'), payload.proof);
  }
  if (payload?.publics !== undefined) {
    const publics = stringifyPublics(payload.publics);
    writeJson(join(dir, 'public.json'), publics);
  }
  if (payload?.normalized !== undefined) {
    const combined = {
      verificationKey: payload.normalized.verificationKey,
      proof: payload.normalized.proof,
      publics: payload.normalized.publics,
    };
    writeJson(join(dir, 'normalized.json'), combined);
  }
}
