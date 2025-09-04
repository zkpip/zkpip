export const CANONICAL_IDS = {
  core: 'urn:zkpip:mvs.core.schema.json',
  verification: 'urn:zkpip:mvs.verification.schema.json',
  issue: 'urn:zkpip:mvs.issue.schema.json',
  ecosystem: 'urn:zkpip:mvs.ecosystem.schema.json',
  proofBundle: 'urn:zkpip:mvs.proof-bundle.schema.json',
  cir: 'urn:zkpip:mvs.cir.schema.json',
} as const;

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];
