import type { Adapter } from "../registry/types.js";
function readStr(x: any): string { return (x ?? "").toString().toLowerCase(); }
function getField(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = k.split(".").reduce((acc: any, part: string) => (acc ? acc[part] : undefined), obj);
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export const zokratesGroth16Stub: Adapter = {
  id: "zokrates-groth16",
  proofSystem: "Groth16",
  framework: "zokrates",
  canHandle(bundle: any) {
    const ps = getField(bundle, ["proofSystem", "meta.proofSystem", "system", "provingScheme"]) ?? "";
    const fw = getField(bundle, ["framework", "meta.framework", "tool", "library", "prover.name"]) ?? "";
    const psL = readStr(ps), fwL = readStr(fw);
    const isGroth = psL.includes("groth") || psL === "g16" || psL === "groth16";
    const isZokrates = fwL.includes("zokrates");
    return isGroth && isZokrates;
  },
  async verify(_bundle: any) {
    return { ok: false, adapter: "zokrates-groth16", error: "not_implemented" };
  },
};
