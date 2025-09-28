// Canonical ZKPIP kinds (schema-aligned) + x-* extensions.
// Keep this file in lockstep with seal.schema.json "kind" enum.
// English comments, no `any`.

// Ergonomic constant map for canonical kinds: K.vector, K.proof, ...
// Keeps code string-literal free while staying type-safe.
export const K = Object.freeze({
  'vector': 'vector',
  'circuit': 'circuit',
  'image': 'image',
  'proof': 'proof',
  'verifying-key': 'verifying-key',
  'params': 'params',
  'verifier-sol': 'verifier-sol',
  'verifier-bytecode': 'verifier-bytecode',
  'manifest': 'manifest',
  'witness': 'witness',
  'proving-key': 'proving-key',
  'transcript': 'transcript',
  'constraints': 'constraints',
  'bench-report': 'bench-report',
  'adapter-meta': 'adapter-meta',
  'attestation': 'attestation',
  'policy': 'policy',
  'bundle': 'bundle',
  'artifact-log': 'artifact-log',
} as const) satisfies Readonly<Record<KnownKind, KnownKind>>;

export const KnownKinds = [
  // M1 canonical
  'vector',
  'circuit',
  'image',
  'proof',
  'verifying-key',
  'params',
  'verifier-sol',
  'verifier-bytecode',
  'manifest',
  'witness',
  // M2 canonical
  'proving-key',
  'transcript',
  'constraints',
  'bench-report',
  // M3 canonical
  'adapter-meta',
  'attestation',
  'policy',
  'bundle',
  'artifact-log',
] as const;

export type KnownKind = typeof KnownKinds[number];

// Allow vendor extensions: x-<lowercase letters, digits, dash>
export type ExtensionKind = `x-${Lowercase<string>}`;
export type Kind = KnownKind | ExtensionKind;

/** CLI-default subset (keep lean for M1 UX). */
export const M1Kinds = [
  'vector',
  'circuit',
  'image',
  'proof',
  'verifying-key',
  'params',
  'verifier-sol',
  'manifest',
  'witness',
] as const satisfies ReadonlyArray<KnownKind>;

export function isKnownKind(x: string): x is KnownKind {
  return (KnownKinds as readonly string[]).includes(x);
}

const EXT_RE = /^x-[a-z0-9-]{1,63}$/;
export function isExtensionKind(x: string): x is ExtensionKind {
  return EXT_RE.test(x);
}

/** Accepts canonical or x-* kinds. */
export function isKind(x: string): x is Kind {
  return isKnownKind(x) || isExtensionKind(x);
}

/** Parse with optional extension allowance (default true). */
export function parseKind(x: string, allowExtensions: boolean = true): Kind | null {
  if (isKnownKind(x)) return x;
  if (allowExtensions && isExtensionKind(x)) return x;
  return null;
}

/** Short help strings for canonical kinds (extensions intentionally undocumented). */
export const KindDoc: Readonly<Record<KnownKind, string>> = {
  'vector': 'Deterministic test vector (small JSON)',
  'circuit': 'Circuit source/definition (e.g., circom/noir)',
  'image': 'Illustrative asset (docs/presentations)',
  'proof': 'Zero-knowledge proof bytes (bin/base64/ref)',
  'verifying-key': 'Verifier key (system-specific)',
  'params': 'SRS/CRS/public parameters (e.g., KZG)',
  'verifier-sol': 'Solidity verifier source code',
  'verifier-bytecode': 'EVM bytecode of the verifier',
  'manifest': 'Build manifest (toolchain, flags, commits)',
  'witness': 'Sensitive witness (store as commitment/ref)',
  'proving-key': 'Proving key (huge/private; prefer ref)',
  'transcript': 'Interactive/Fiat–Shamir transcript',
  'constraints': 'Derived constraint system (R1CS/IR)',
  'bench-report': 'Benchmark metrics (time/memory)',
  'adapter-meta': 'ZKPIP adapter metadata & capabilities',
  'attestation': 'Signed statement/claim about artifacts',
  'policy': 'Verification/pedigree policy definition',
  'bundle': 'Bundle referencing multiple artifacts',
  'artifact-log': 'Build/verification log (summarized)',
} as const;

/** Optional: stage tags for roadmap/UX filtering. */
export const KindStage: Readonly<Record<KnownKind, 'M1' | 'M2' | 'M3'>> = {
  'vector': 'M1',
  'circuit': 'M1',
  'image': 'M1',
  'proof': 'M1',
  'verifying-key': 'M1',
  'params': 'M1',
  'verifier-sol': 'M1',
  'verifier-bytecode': 'M1',
  'manifest': 'M1',
  'witness': 'M1',
  'proving-key': 'M2',
  'transcript': 'M2',
  'constraints': 'M2',
  'bench-report': 'M2',
  'adapter-meta': 'M3',
  'attestation': 'M3',
  'policy': 'M3',
  'bundle': 'M3',
  'artifact-log': 'M3',
} as const;

/**
 * Lightweight URN guard:
 * Accepts urn:zkpip:<subject>:sha256:<hex64>.
 * Ensures <subject> matches the provided kind (canonical or x-*).
 */
export function ensureUrnMatchesKind(kind: Kind, urn: string): void {
  const parts = urn.split(':');
  if (parts.length < 5 || parts[0] !== 'urn' || parts[1] !== 'zkpip') {
    throw new Error(`Malformed URN: ${urn}`);
  }
  const subject = parts[2];
  if (subject !== kind) {
    throw new Error(`Kind/URN mismatch: kind=${kind}, urn=${urn}`);
  }
}
