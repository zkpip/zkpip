// ZKPIP CLI – `vectors verify-seal` (Seal v1)
// ESM, strict TS, no `any`
// Uses centralized helpers from @zkpip/core:
//  - prepareBodyDigest(body, kind) → canon + expected URN
//  - validateSealV1 → fast structural checks

export { verifySealV1 } from '@zkpip/core';
export type { VerifySealResult, VerifyStage, SealV1, Options } from '@zkpip/core';
export { verifySealV1 as default } from '@zkpip/core';
