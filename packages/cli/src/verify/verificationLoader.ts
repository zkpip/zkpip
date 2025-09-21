// Strict ESM, no "any".
// Loader + quick-precheck for verification inputs that may be:
// - ProofEnvelope (MVS v0.1.0), or
// - legacy verification JSON (fallback).

import { readFileSync } from 'node:fs';

export interface EnvelopeLike {
  schemaVersion?: unknown;
  envelopeId?: unknown;
  proofSystem?: unknown;
  prover?: unknown;
  result?: unknown;
}

export interface ResultLike {
  proof?: unknown;
  publicSignals?: unknown;
}

export interface LoadedVerification {
  json: unknown;
  isEnvelope: boolean;
  proofSystem: string;
  prover?: string;
}

export function loadJsonFile(path: string): unknown {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as unknown;
}

export function isProofEnvelope(json: unknown): json is EnvelopeLike {
  if (typeof json !== 'object' || json === null) return false;
  const o = json as Record<string, unknown>;
  const res = o['result'] as ResultLike | undefined;
  return (
    o['schemaVersion'] === '0.1.0' &&
    typeof o['envelopeId'] === 'string' &&
    typeof res?.proof !== 'undefined' &&
    typeof res?.publicSignals !== 'undefined'
  );
}

export function envelopeQuickMeta(json: EnvelopeLike): { proofSystem?: string; prover?: string } {
  // Build object without inserting undefined values (exactOptionalPropertyTypes-safe)
  const out: { proofSystem?: string; prover?: string } = {};
  if (typeof json.proofSystem === 'string') out.proofSystem = json.proofSystem;
  if (typeof json.prover === 'string') out.prover = json.prover;
  return out;
}

export function loadVerificationWithMeta(filePath: string): LoadedVerification {
  const json = loadJsonFile(filePath);

  if (isProofEnvelope(json)) {
    const { proofSystem, prover } = envelopeQuickMeta(json);
    if (!proofSystem) {
      throw new Error('schema_invalid: envelope missing proofSystem');
    }
    // do NOT insert undefined fields when exactOptionalPropertyTypes=true
    return {
      json,
      isEnvelope: true,
      proofSystem,
      ...(typeof prover === 'string' ? { prover } : {}),
    };
  }

  if (typeof json === 'object' && json !== null) {
    const o = json as Record<string, unknown>;
    const ps = typeof o['proofSystem'] === 'string' ? o['proofSystem'] : undefined;
    const fw = typeof o['framework'] === 'string' ? o['framework'] : undefined;
    const found = ps ?? fw;
    if (found) {
      return {
        json,
        isEnvelope: false,
        proofSystem: found,
        // legacy path has no reliable prover → don't include key at all
      };
    }
  }

  throw new Error('schema_invalid: missing framework/proofSystem in verification JSON (quick precheck)');
}
