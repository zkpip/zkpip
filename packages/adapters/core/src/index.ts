// packages/adapters/core/src/index.ts
// Core contracts for ZKPIP adapters (ESM, strict TypeScript, no `any`).
// Comments in English for OSS clarity.

/* -------------------------------------------------------------------------- */
/*                               JSON value types                             */
/* -------------------------------------------------------------------------- */
// Keep these identical to existing defs (e.g., dumpNormalize.ts) to avoid churn.
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { readonly [k: string]: JsonValue } | readonly JsonValue[];
export type JsonObject = { readonly [k: string]: JsonValue };

// Legacy/compat alias – safe to keep until full unification later.
export type Json = JsonValue;

/* -------------------------------------------------------------------------- */
/*                             Proof envelope (v1)                             */
/* -------------------------------------------------------------------------- */

export type ProofSystem = 'groth16' | 'plonk';

/** Public signals accepted by common JS verifiers (e.g., snarkjs). */
export type PublicValue = string | number | bigint;

/** Minimal canonical envelope for ZKPIP v1 adapters. */
export interface ProofEnvelopeV1 {
  /** Static version field to allow future breaking changes. */
  readonly version: 1;
  /** "groth16" | "plonk" */
  readonly proofSystem: ProofSystem;
  /** Library / framework marker, e.g., "snarkjs", "zokrates", "gnark". */
  readonly framework: string;
  /** Verification key payload (JSON-serializable). */
  readonly vkey: JsonValue;
  /** Proof payload (JSON-serializable). */
  readonly proof: JsonValue;
  /** Ordered list of public inputs/signals. */
  readonly publics: readonly PublicValue[];
  /** Optional extra metadata (tooling hints, hashes, etc.). */
  readonly meta?: JsonObject;
}

/* -------------------------------------------------------------------------- */
/*                                Adapter API                                  */
/* -------------------------------------------------------------------------- */

export interface Adapter {
  /** Globally unique id, e.g., "snarkjs-groth16". */
  readonly id: string;
  /** Cheap, side-effect-free shape check. */
  canHandle(input: unknown): boolean;
  /** Normalize `input` to a canonical `ProofEnvelopeV1`. Throws on irrecoverable issues. */
  toEnvelope(input: unknown): ProofEnvelopeV1;
  /** Verify `input` (envelope or raw). May use dynamic imports. Throws on fatal errors. */
  verify(input: unknown): Promise<boolean>;
}

/* -------------------------------------------------------------------------- */
/*                               Registry helpers                              */
/* -------------------------------------------------------------------------- */

const REGISTRY: Adapter[] = [];

/**
 * Register one or more adapters. If an id already exists, it will be replaced,
 * preserving order (latest wins) to make hot-reload/dev workflows predictable.
 */
export function registerAdapter(...adapters: readonly Adapter[]): void {
  for (const a of adapters) {
    const idx = REGISTRY.findIndex((x) => x.id === a.id);
    if (idx >= 0) {
      REGISTRY.splice(idx, 1, a);
    } else {
      REGISTRY.push(a);
    }
  }
}

/** Return a read-only snapshot of currently registered adapters. */
export function listAdapters(): readonly Adapter[] {
  return REGISTRY.slice();
}

/** Detect the first adapter whose `canHandle` returns true (registration order). */
export function detect(input: unknown): Adapter | undefined {
  for (const a of REGISTRY) {
    try {
      if (a.canHandle(input)) return a;
    } catch {
      // Ignore detection errors and continue.
    }
  }
  return undefined;
}

/** Detect adapter and build an envelope, or throw if none matches. */
export function toEnvelopeWithDetected(input: unknown): ProofEnvelopeV1 {
  const adapter = detect(input);
  if (!adapter) throw new Error('zkpip/no_adapter_found');
  return adapter.toEnvelope(input);
}

/** Detect adapter and verify, or throw on fatal adapter errors. */
export async function verifyWithDetected(input: unknown): Promise<boolean> {
  const adapter = detect(input);
  if (!adapter) throw new Error('zkpip/no_adapter_found');
  return adapter.verify(input);
}

/** Narrower type guard for `ProofEnvelopeV1` – handy for CLI/dev tooling. */
export function isProofEnvelopeV1(x: unknown): x is ProofEnvelopeV1 {
  if (!isObject(x)) return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === 1 &&
    (o.proofSystem === 'groth16' || o.proofSystem === 'plonk') &&
    typeof o.framework === 'string' &&
    typeof o.vkey !== 'undefined' &&
    typeof o.proof !== 'undefined' &&
    Array.isArray((o as { publics?: unknown }).publics) &&
    (o as { publics: unknown[] }).publics.every(isPublicValue)
  );
}

/* --------------------------------- utils ---------------------------------- */

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isPublicValue(x: unknown): x is PublicValue {
  const t = typeof x;
  return t === 'string' || t === 'number' || t === 'bigint';
}
