// packages/core/src/validation/aliases.ts
import { CANONICAL_IDS } from "../schemaUtils.js";

export const ALIASES: Record<string, string[]> = {
  [CANONICAL_IDS.proofBundle]: [
    "mvs.proof-bundle",
    "mvs/proof-bundle",
    "mvs.proof-bundle.schema.json",
    "mvs/verification/proofBundle",
  ],
  [CANONICAL_IDS.cir]: [
    "mvs.cir",
    "mvs/cir",
    "mvs.cir.schema.json",
    "mvs/verification/cir",
  ],
  [CANONICAL_IDS.verification]: [
    "mvs.verification",
    "mvs/verification",
    "mvs.verification.schema.json",
  ],
  [CANONICAL_IDS.issue]: [
    "mvs.issue",
    "mvs/issue",
    "mvs.issue.schema.json",
  ],
  [CANONICAL_IDS.ecosystem]: [
    "mvs.ecosystem",
    "mvs/ecosystem",
    "mvs.ecosystem.schema.json",
  ],
};

// Derived HTTPS aliases from canonical URNs
export function httpsAliasOf(canonicalId: string): string {
  const tail = canonicalId.split(":").pop()!;
  return `https://zkpip.org/schemas/${tail}`;
}
