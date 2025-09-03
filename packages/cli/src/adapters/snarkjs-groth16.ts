import fs from "node:fs";
import path from "node:path";
import * as snarkjs from "snarkjs";
import type { Adapter } from "../registry/types.js";

const { groth16 } = snarkjs;

// ---- helpers ---------------------------------------------------------------
function readStr(x: unknown): string {
  return (x ?? "").toString();
}
function readLower(x: unknown): string {
  return readStr(x).toLowerCase();
}
function getField<T = unknown>(obj: any, paths: string[]): T | undefined {
  for (const p of paths) {
    const v = p.split(".").reduce((acc: any, key: string) => (acc ? acc[key] : undefined), obj);
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}
function ensureArray(x: any): any[] {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}
function normalizeSignals(arr: any[]): any[] {
  return arr.map((v) => {
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "number") return Math.trunc(v).toString();
    const s = String(v);
    if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s).toString();
    return s;
  });
}
async function loadJsonMaybeFile(inputDir: string, valueOrPath: any): Promise<any> {
  if (typeof valueOrPath === "string") {
    const p = valueOrPath.trim();
    if (p.startsWith("{") || p.startsWith("[")) return JSON.parse(p);
    const abs = path.isAbsolute(p) ? p : path.resolve(inputDir, p);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  }
  return valueOrPath;
}

// ---- adapter ---------------------------------------------------------------
export const snarkjsGroth16: Adapter = {
  id: "snarkjs-groth16",
  proofSystem: "Groth16",
  framework: "snarkjs",

  canHandle(bundle: any): boolean {
    const ps = getField<string>(bundle, [
      "proofSystem",
      "meta.proofSystem",
      "system",
      "provingScheme",
    ]) ?? "";
    const fw = getField<string>(bundle, [
      "framework",
      "meta.framework",
      "tool",
      "library",
      "prover.name",
    ]) ?? "";
    const psL = readLower(ps), fwL = readLower(fw);
    const isGroth = psL.includes("groth") || psL === "g16" || psL === "groth16";
    const isSnarkjs = fwL.includes("snarkjs") || fwL.includes("circom") || fwL.includes("zkey");

    const hasProof = bundle?.proof || bundle?.groth16Proof || bundle?.meta?.proof || bundle?.meta?.groth16Proof;
    const hasPublic = bundle?.publicSignals || bundle?.publicInputs || bundle?.meta?.publicSignals || bundle?.meta?.publicInputs;
    const hasVkey = bundle?.verificationKey || bundle?.vkey || bundle?.vk || bundle?.meta?.verificationKey || bundle?.meta?.vkey || bundle?.meta?.vk;

    return (isGroth && isSnarkjs) || (hasProof && hasPublic && hasVkey);
  },

  async verify(bundle: any) {
    try {
      const baseDir = process.cwd();

      const vkeyCandidate =
        getField<any>(bundle, ["verificationKey","vkey","vk","meta.verificationKey","meta.vkey","meta.vk"]);
      if (!vkeyCandidate) return { ok: false, adapter: this.id, error: "missing_verification_key" };
      const vkey = await loadJsonMaybeFile(baseDir, vkeyCandidate);

      let proof = getField<any>(bundle, ["proof","groth16Proof","meta.proof","meta.groth16Proof"]);
      if (!proof) return { ok: false, adapter: this.id, error: "missing_proof" };
      proof = await loadJsonMaybeFile(baseDir, proof);

      let publicSignals =
        ensureArray(getField<any[]>(bundle, ["publicSignals","publicInputs","meta.publicSignals","meta.publicInputs"]) ?? []);
      publicSignals = normalizeSignals(publicSignals);

      const ok = await groth16.verify(vkey, publicSignals, proof);
      return ok ? { ok: true, adapter: this.id } : { ok: false, adapter: this.id, error: "verification_failed" };
    } catch (err: any) {
      return { ok: false, adapter: this.id, error: String(err?.message || err) };
    }
  },
};
