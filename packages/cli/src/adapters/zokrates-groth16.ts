import type { Adapter } from "../registry/types.js";

// Utilities: normalize input fields across potential shapes
function toLower(x: unknown): string | undefined {
  return typeof x === "string" ? x.toLowerCase() : undefined;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function get<T = unknown>(o: unknown, key: string): T | undefined {
  if (!isObject(o)) return undefined;
  const v = (o as Record<string, unknown>)[key];
  return v as T | undefined;
}

function ensureHexStrings(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "number") out.push("0x" + v.toString(16));
    else return undefined;
  }
  return out;
}

// Detect if the input looks like a ZoKrates Groth16 verification record/bundle
function looksZoKratesGroth16(input: unknown): boolean {
  // Accept explicit meta markers first
  const proofSystem =
    toLower(get(input, "proofSystem")) ?? toLower(get(get(input, "meta"), "proofSystem"));
  const framework =
    toLower(get(input, "framework")) ?? toLower(get(get(input, "meta"), "framework"));

  if (proofSystem === "groth16" && framework === "zokrates") return true;

  // Heuristic by shape: presence of "proof" with a/b/c, plus "inputs" or "publicInputs"
  const proof = get(input, "proof");
  const a = get<unknown[]>(proof, "a");
  const b = get<unknown[]>(proof, "b");
  const c = get<unknown[]>(proof, "c");
  const inputs = get(input, "inputs") ?? get(input, "publicInputs") ?? get(get(input, "bundle"), "publicSignals");

  if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c) && Array.isArray(inputs)) {
    return true;
  }

  return false;
}

// Extract a normalized ZoKrates verify tuple: (vkey, proof, inputs)
function extractZoKratesArgs(input: unknown): { vkey: unknown; proof: unknown; inputs: string[] } | null {
  const vkey =
    get(input, "verificationKey") ??
    get(get(input, "meta"), "verificationKey") ??
    get(input, "vkey") ??
    get(get(input, "bundle"), "verificationKey");
  const proof = get(input, "proof") ?? get(get(input, "bundle"), "proof");
  const inputsRaw =
    get(input, "inputs") ??
    get(input, "publicInputs") ??
    get(get(input, "bundle"), "publicSignals") ??
    get(get(input, "meta"), "publicInputs");

  if (!vkey || !proof || !Array.isArray(inputsRaw)) return null;

  const inputs = ensureHexStrings(inputsRaw);
  if (!inputs) return null;

  // Quick shape guard for Groth16 a/b/c to avoid passing junk to the wasm
  const a = get<unknown[]>(proof, "a");
  const b = get<unknown[]>(proof, "b");
  const c = get<unknown[]>(proof, "c");
  if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c)) return null;

  return { vkey, proof, inputs };
}

export const zokratesGroth16: Adapter = {
  id: "zokrates-groth16",
  proofSystem: "groth16",
  framework: "zokrates",

  canHandle(input: unknown): boolean {
    return looksZoKratesGroth16(input);
  },

  async verify(input: unknown) {
    // Extract normalized args; if not present, mark as invalid_input
    const args = extractZoKratesArgs(input);
    if (!args) {
      return { ok: false, adapter: this.id, error: "invalid_input" as const };
    }

    // Lazy import to avoid pulling wasm unless actually used
    let provider: { verify: (vk: unknown, proof: unknown, inputs: string[]) => unknown };
    try {
      const { initialize } = await import("zokrates-js");
      provider = await initialize();
    } catch (_e) {
      // If zokrates-js is not installed/available, degrade gracefully.
      return { ok: false, adapter: this.id, error: "not_implemented" as const };
    }

    try {
      const verdict = await provider.verify(args.vkey, args.proof, args.inputs);
      const ok = verdict === true;
      return ok ? { ok: true, adapter: this.id } : { ok: false, adapter: this.id, error: "verification_failed" as const };
    } catch (err) {
      // Map any internal error as adapter error (keep it opaque to the CLI)
      const msg = (err as Error)?.message ?? String(err);
      return { ok: false, adapter: this.id, error: msg };
    }
  },
};
