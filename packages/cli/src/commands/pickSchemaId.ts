import { basename } from "node:path";
import { CANONICAL_IDS } from "@zkpip/core";

const ids = {
  proofBundle: CANONICAL_IDS.proofBundle,
  verification: CANONICAL_IDS.verification,
  cir: CANONICAL_IDS.cir,
  issue: CANONICAL_IDS.issue,
  ecosystem: CANONICAL_IDS.ecosystem,
  core: CANONICAL_IDS.core,
};

function isProofBundleLike(x: any): boolean {
  const a = x?.artifacts;
  return !!(x?.mvs?.kind === "proofBundle" || (a && a.verificationKey && a.proof && a.publicSignals));
}

function isLegacyVerificationLike(x: any): boolean {
  const r = x?.result;
  return !!(x?.verifier?.verificationKey && r?.proof && r?.publicSignals);
}

export function pickSchemaId(inputOrPath: unknown): string {
  if (inputOrPath && typeof inputOrPath === "object") {
    const data = inputOrPath as any;

    if (typeof data.$schema === "string") return data.$schema;

    if (isProofBundleLike(data)) return ids.proofBundle;
    if (isLegacyVerificationLike(data)) return ids.verification;
  }

  const name = typeof inputOrPath === "string" ? basename(inputOrPath).toLowerCase() : "";

  if (name.includes("proof-bundle") || name.includes("bundle") || name.includes("manifest")) {
    return ids.proofBundle;
  }
  if (name.includes("cir") || name.includes("circuit")) {
    return ids.cir;
  }
  if (name.includes("verification") || name.includes("verify") || name.includes("error")) {
    return ids.verification;
  }
  if (name.includes("issue")) {
    return ids.issue;
  }
  if (name.includes("ecosystem") || name.includes("eco")) {
    return ids.ecosystem;
  }
  return ids.core;
}
