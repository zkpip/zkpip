export const CANONICAL_IDS = {
  core: 'urn:zkpip:mvs:schemas:core.schema.json',
  verification: 'urn:zkpip:mvs:schemas:verification.schema.json',
  issue: 'urn:zkpip:mvs:schemas:issue.schema.json',
  ecosystem: 'urn:zkpip:mvs:schemas:ecosystem.schema.json',
  proofBundle: 'urn:zkpip:mvs:schemas:proofBundle.schema.json',
  cir: 'urn:zkpip:mvs:schemas:cir.schema.json',
  proofEnvelope: 'urn:zkpip:mvs.proofEnvelope.schema.json',
} as const;

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];
