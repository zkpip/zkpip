// packages/cli/src/utils/forgeEnvelope.ts
import { randomUUID } from 'node:crypto';

export interface ForgeMeta {
  proofSystem: string;
  curve: string;
  prover: string;
  program: string;
}

export interface ProofEnvelope<TProof = unknown, TPublics = unknown> {
  envelopeId: string;              // urn:uuid:...
  schemaVersion: '0.1.0';
  proofSystem: string;
  curve: string;
  prover: string;
  program: string;
  artifacts: {
    verificationPath?: string;
    proofPath?: string;
    publicsPath?: string;
  };
  result: {
    proof: TProof;
    publicSignals: TPublics;
  };
}

function toUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

// Helper: include optional keys only if defined (to satisfy exactOptionalPropertyTypes)
function buildArtifacts(paths?: {
  verificationPath?: string;
  proofPath?: string;
  publicsPath?: string;
  vkeyUri?: string;
}) {
  const a: {
    verificationPath?: string;
    proofPath?: string;
    publicsPath?: string;
    vkey?: { path: string; uri?: string };
  } = {};

  if (paths?.verificationPath) {
    a.verificationPath = paths.verificationPath;
    a.vkey = { path: paths.verificationPath, ...(paths.vkeyUri ? { uri: paths.vkeyUri } : {}) };
  } else if (paths?.vkeyUri) {
    a.vkey = { path: '', uri: paths.vkeyUri };
  }

  if (paths?.proofPath) a.proofPath = paths.proofPath;
  if (paths?.publicsPath) a.publicsPath = paths.publicsPath;

  return a;
}

export function makeEnvelope<TProof, TPublics>(
  meta: ForgeMeta,
  triplet: {
    proof: TProof;
    publics: TPublics;
    paths?: { verificationPath?: string; proofPath?: string; publicsPath?: string };
  },
): ProofEnvelope<TProof, TPublics> {
  return {
    envelopeId: toUrnUuid(randomUUID()),
    schemaVersion: '0.1.0',
    proofSystem: meta.proofSystem,
    curve: meta.curve,
    prover: meta.prover,
    program: meta.program,
    artifacts: buildArtifacts(triplet.paths), // <-- no undefined properties included
    result: {
      proof: triplet.proof,
      publicSignals: triplet.publics,
    },
  };
}
