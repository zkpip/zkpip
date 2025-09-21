export const SCHEMA_VERSION = '0.1.0' as const;
// Pin to 2020-12 by design (ajv v8 compatible)
export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema' as const;
export const PROOF_ENVELOPE_SCHEMA_ID = `urn:zkpip:schema:proof-envelope:${SCHEMA_VERSION}` as const;
