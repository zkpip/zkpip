// Strict ESM, no "any". Envelope-or-Triplet extractor for forge.
// - Envelope mode: prefer a local ProofEnvelope JSON (no legacy "bundle" support).
// - Triplet mode: fall back to separate verification/proof/publics JSON files.

import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export interface TripletPaths {
  verificationPath: string;
  proofPath: string;
  publicsPath: string;
  vkeyUri?: string;
}

export interface ExtractedTriplet<TProof = unknown, TPublics = unknown, TVerification = unknown> {
  verification: TVerification;
  proof: TProof;
  publics: TPublics;
  paths: TripletPaths;
}

const envelopeCandidates = [
  'proof-envelope.json',
  'proof-envelope.result.json',
  'proof-envelope.valid.json',
];

const verificationCandidates = ['verification.json', 'verification_key.json', 'verification.key'];
const proofCandidates = ['proof.json'];
const publicsCandidates = ['public.json', 'publics.json', 'publicSignals.json'];

/** Pick the first existing file from candidates or throw with a helpful message. */
function pickFirstExisting(baseDir: string, files: string[]): string {
  for (const f of files) {
    const p = join(baseDir, f);
    if (existsSync(p)) return p;
  }
  throw new Error(`Missing file in ${baseDir}: tried [${files.join(', ')}]`);
}

function tryLoadEnvelopeWithPaths<TProof, TPublics>(
  baseDir: string,
): { path: string; proof: TProof; publics: TPublics; vkeyPath?: string; vkeyUri?: string } | undefined {
  for (const filename of envelopeCandidates) {
    const absPath = join(baseDir, filename);
    if (!existsSync(absPath)) continue;

    const raw = readFileSync(absPath, 'utf8');
    const jsonObj = JSON.parse(raw) as Record<string, unknown>;
    const res = jsonObj['result'] as { proof?: unknown; publicSignals?: unknown } | undefined;
    if (typeof res?.proof === 'undefined' || typeof res?.publicSignals === 'undefined') continue;

    // pick vkey path/uri from artifacts if present
    let vkeyPath: string | undefined;
    let vkeyUri: string | undefined;
    const arts = jsonObj['artifacts'];
    if (arts && typeof arts === 'object') {
      const vkeyObj = (arts as Record<string, unknown>)['vkey'];
      if (vkeyObj && typeof vkeyObj === 'object') {
        const pth = (vkeyObj as Record<string, unknown>)['path'];
        if (typeof pth === 'string' && pth.length > 0) vkeyPath = pth;
        const uri = (vkeyObj as Record<string, unknown>)['uri'];
        if (typeof uri === 'string' && uri.length > 0) vkeyUri = uri;
      }
      const verifPath = (arts as Record<string, unknown>)['verificationPath'];
      if (!vkeyPath && typeof verifPath === 'string' && verifPath.length > 0) vkeyPath = verifPath;
    }

    return {
      path: absPath,
      proof: res.proof as TProof,
      publics: res.publicSignals as TPublics,
      ...(vkeyPath ? { vkeyPath } : {}),
      ...(vkeyUri ? { vkeyUri } : {}),
    };
  }
  return undefined;
}

/**
 * Extract a (verification, proof, publics) triplet from a directory.
 * Priority:
 *  1) ProofEnvelope file (no legacy "bundle" support).
 *  2) Separate verification/proof/publics JSON files.
 */
export function extractTripletFromDir<TProof = unknown, TPublics = unknown, TVerification = unknown>(
  dir: string,
) {
  const env = tryLoadEnvelopeWithPaths<TProof, TPublics>(dir);
  if (env) {
    return {
      verification: {} as TVerification,
      proof: env.proof as TProof,
      publics: env.publics as TPublics,
      paths: {
        verificationPath: env.vkeyPath ?? '',
        proofPath: env.path,
        publicsPath: env.path,
        ...(env.vkeyUri ? { vkeyUri: env.vkeyUri } : {}),
      },
    };
  }

  // 2) Triplet mode — locate and parse separate files
  const verificationPath = pickFirstExisting(dir, verificationCandidates);
  const proofPath = pickFirstExisting(dir, proofCandidates);
  const publicsPath = pickFirstExisting(dir, publicsCandidates);

  const verificationRaw = readFileSync(verificationPath, 'utf8');
  const proofRaw = readFileSync(proofPath, 'utf8');
  const publicsRaw = readFileSync(publicsPath, 'utf8');

  const verification = JSON.parse(verificationRaw) as TVerification;
  const proof = JSON.parse(proofRaw) as TProof;
  const publics = JSON.parse(publicsRaw) as TPublics;

  return {
    verification,
    proof,
    publics,
    paths: { verificationPath, proofPath, publicsPath },
  };
}
