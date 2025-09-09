// add these helpers (if not present yet)
export function parseJsonIfString(x: unknown): unknown {
  if (typeof x === 'string') {
    const s = x.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try { return JSON.parse(s); } catch { /* ignore */ }
    }
  }
  return x;
}

export function toArrayFromMaybeString(x: unknown): unknown[] | undefined {
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') {
    const parsed = parseJsonIfString(x);
    if (Array.isArray(parsed)) return parsed;
    const parts = x.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
}

// replace normalizePublicSignals with this
export function normalizePublicSignals(x: unknown): ReadonlyArray<PublicSignal> {
  const arr = toArrayFromMaybeString(x) ?? (Array.isArray(x) ? x : []);
  const out: PublicSignal[] = [];
  for (const v of arr) {
    if (typeof v === 'string') {
      out.push(v.startsWith('0x') || v.startsWith('0X') ? BigInt(v).toString(10) : v);
    } else if (typeof v === 'number') {
      out.push(BigInt(v).toString(10));
    } else if (typeof v === 'bigint') {
      out.push(v.toString(10));
    } else {
      // invalid elem esetén üres tömb -> upstream adapter_error/verification_failed
      return [];
    }
  }
  return out;
}

// NodeNext ESM helpers shared by all adapters (no 'any', exactOptionalPropertyTypes-friendly)
import { readFileSync } from 'node:fs';

/** ---------- Public types ---------- */
export type PublicSignal = string | number | bigint;

/** ---------- Tiny type guards & getters ---------- */
export function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function get<T = unknown>(o: unknown, key: string): T | undefined {
  if (!isObj(o)) return undefined;
  return (o as Record<string, unknown>)[key] as T | undefined;
}

export function getPath(o: unknown, path: string): unknown {
  if (!isObj(o)) return undefined;
  const parts = path.split('.');
  let cur: unknown = o;
  for (const p of parts) {
    if (!isObj(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** ---------- Generic deep-search helpers ---------- */
export function deepFindFirst(root: unknown, pred: (x: unknown) => boolean): unknown | undefined {
  const seen = new Set<unknown>();
  function walk(node: unknown): unknown | undefined {
    if (node === null || typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const el of node) {
        const got = walk(el);
        if (got !== undefined) return got;
      }
      return undefined;
    }
    if (pred(node)) return node;
    for (const val of Object.values(node as Record<string, unknown>)) {
      const got = walk(val);
      if (got !== undefined) return got;
    }
    return undefined;
  }
  return walk(root);
}

export function deepFindByKeys(root: unknown, keys: readonly string[]): unknown | undefined {
  const seen = new Set<unknown>();
  function walk(node: unknown): unknown | undefined {
    if (node === null || typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const el of node) {
        const got = walk(el);
        if (got !== undefined) return got;
      }
      return undefined;
    }
    const obj = node as Record<string, unknown>;
    for (const k of keys) {
      if (obj[k] !== undefined) return obj[k];
    }
    for (const val of Object.values(obj)) {
      const got = walk(val);
      if (got !== undefined) return got;
    }
    return undefined;
  }
  return walk(root);
}

export function pickFirstKey(obj: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined) return v;
  }
  return undefined;
}

/** ---------- Safe stringify, small utils ---------- */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export function toLower(x: unknown): string | undefined {
  return typeof x === 'string' ? x.toLowerCase() : undefined;
}

/** ---------- ZoKrates helper ---------- */
export function ensureHexStrings(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push('0x' + v.toString(16));
    else return undefined;
  }
  return out;
}

/** ---------- Input materialization (path → JSON object) ---------- */
export function materializeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    try { return JSON.parse(readFileSync(input, 'utf8')); } catch { return input; }
  }
  if (isObj(input)) {
    const b = (input as Record<string, unknown>)['bundle'];
    const bp = (input as Record<string, unknown>)['bundlePath'];
    if (typeof b === 'string') {
      try { return JSON.parse(readFileSync(b, 'utf8')); } catch { /* ignore */ }
    }
    if (typeof bp === 'string') {
      try { return JSON.parse(readFileSync(bp, 'utf8')); } catch { /* ignore */ }
    }
  }
  return input;
}

/** ---------- Minimal debug (stderr, safe for --json) ---------- */
export function debug(...args: ReadonlyArray<unknown>): void {
  if (process.env.ZKPIP_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.error('[zkpip]', ...args);
  }
}



