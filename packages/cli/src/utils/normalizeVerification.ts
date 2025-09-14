// Accept many incoming shapes and map them to a canonical triplet:
// { verification_key, proof, public } as Json.
//
// Supported variants (any of these can be either top-level or nested under
//   artifacts / bundle / proofBundle):
// - verification_key | verificationKey | vkey | vk
// - proof | proofData | pi
// - public | publics | publicSignals | inputs | public_inputs
//
// If we see stringified JSON for any part, we JSON.parse() it safely.

import type { Json } from '../types/json.js';

type Triplet = {
  readonly verification_key: Json;
  readonly proof: Json;
  readonly public: Json;
};

function isRec(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function firstDefined<T>(...vals: readonly T[]): T | undefined {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

function maybeParseJson(x: unknown): Json | undefined {
  if (typeof x === 'string') {
    const s = x.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        return JSON.parse(s) as Json;
      } catch {
        // fallthrough → return as-is
      }
    }
  }
  return x as Json;
}

function pickTriplet(obj: unknown): Triplet | undefined {
  if (!isRec(obj)) return undefined;

  // Collect candidates (allow both snake_case and camelCase aliases)
  const vk = firstDefined(obj['verification_key'], obj['verificationKey'], obj['vkey'], obj['vk']);
  const proof = firstDefined(obj['proof'], obj['proofData'], obj['pi']);
  const pub = firstDefined(
    obj['public'],
    obj['publics'],
    obj['publicSignals'],
    obj['inputs'],
    obj['public_inputs'],
  );

  if (vk !== undefined && proof !== undefined && pub !== undefined) {
    return {
      verification_key: maybeParseJson(vk)!,
      proof: maybeParseJson(proof)!,
      public: maybeParseJson(pub)!,
    };
  }
  return undefined;
}

export function normalizeVerification(input: Json): Triplet {
  // 1) Try nested containers first
  if (isRec(input)) {
    const candidates = [input['artifacts'], input['bundle'], input['proofBundle']];
    for (const c of candidates) {
      const t = pickTriplet(c);
      if (t) return t;
    }
  }

  // 2) Try top-level flat triplet
  const top = pickTriplet(input);
  if (top) return top;

  // 3) Nothing matched → schema-ish failure
  throw new Error(
    'unrecognized verification JSON shape (expected artifacts/bundle or flat triplet)',
  );
}
