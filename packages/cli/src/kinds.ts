import type { Kind } from '@zkpip/core/kind';

// Internal, non-canonical kinds used in CLI pipeline stages.
// Always prefix with x- to stay schema-compatible.
export const K_VERIFICATION_JSON: Kind = 'x-verification-json';
