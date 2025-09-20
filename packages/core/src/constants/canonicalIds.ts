export const CANONICAL_IDS = {
  core:          'urn:zkpip:mvs:schemas:core.schema.json',
  ecosystem:     'urn:zkpip:mvs:schemas:ecosystem.schema.json',
  issue:         'urn:zkpip:mvs:schemas:issue.schema.json',
  proofEnvelope: 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json', // <- only once, correct namespace
  verification:  'urn:zkpip:mvs:schemas:verification.schema.json',
  cir:           'urn:zkpip:mvs:schemas:cir.schema.json'
} as const;

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];
