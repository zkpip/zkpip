import type { Adapter } from "../registry/types.js";

/** ---------- JSON típusok (any nélkül) ---------- */
type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | Json[] | JsonObject;
type JsonObject = { [k: string]: Json };

/** ---------- Utilok ---------- */
function toLower(x: unknown): string | undefined {
  return typeof x === "string" ? x.toLowerCase() : undefined;
}

function isJsonObject(x: unknown): x is JsonObject {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function get<T extends Json = Json>(o: unknown, key: string): T | undefined {
  if (!isJsonObject(o)) return undefined;
  return o[key] as T | undefined;
}

function ensureHexStrings(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === "string") {
      out.push(v);
    } else if (typeof v === "number") {
      out.push("0x" + v.toString(16));
    } else {
      return undefined;
    }
  }
  return out;
}

/** ---------- Heurisztikus felismerés ---------- */
function looksZoKratesGroth16(input: unknown): boolean {
  // explicit meta
  const proofSystem =
    toLower(get(input, "proofSystem")) ??
    toLower(get(get(input, "meta"), "proofSystem"));
  const framework =
    toLower(get(input, "framework")) ??
    toLower(get(get(input, "meta"), "framework"));

  if (proofSystem === "groth16" && framework === "zokrates") return true;

  // shape-alapú: proof {a,b,c} + inputs/publicInputs/bundle.publicSignals
  const proof = get(input, "proof");
  const a = get<Json[]>(proof, "a");
  const b = get<Json[][]>(proof, "b");
  const c = get<Json[]>(proof, "c");
  const inputs =
    get(input, "inputs") ??
    get(input, "publicInputs") ??
    get(get(input, "bundle"), "publicSignals");

  if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c) && Array.isArray(inputs)) {
    return true;
  }
  return false;
}

/** ---------- Normalizált argumentumok kinyerése ---------- */
type ExtractedArgs = {
  vkey: JsonObject; // ZoKrates verify első paramétere: object
  proofABC: { a: Json[]; b: Json[][]; c: Json[] };
  inputs: string[];
};

function extractZoKratesArgs(input: unknown): ExtractedArgs | null {
  const vkeyRaw =
    get(input, "verificationKey") ??
    get(get(input, "meta"), "verificationKey") ??
    get(input, "vkey") ??
    get(get(input, "bundle"), "verificationKey");

  if (!isJsonObject(vkeyRaw)) return null;

  const proof = get(input, "proof") ?? get(get(input, "bundle"), "proof");
  const a = get<Json[]>(proof, "a");
  const b = get<Json[][]>(proof, "b");
  const c = get<Json[]>(proof, "c");
  if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c)) return null;

  const inputsRaw =
    get(input, "inputs") ??
    get(input, "publicInputs") ??
    get(get(input, "bundle"), "publicSignals") ??
    get(get(input, "meta"), "publicInputs");

  if (!Array.isArray(inputsRaw)) return null;
  const inputs = ensureHexStrings(inputsRaw);
  if (!inputs) return null;

  return { vkey: vkeyRaw, proofABC: { a, b, c }, inputs };
}

/** ---------- ZoKrates minimál típusok ---------- */
type ZoKratesProof = {
  a: Json[];        // [x,y]
  b: Json[][];      // [[x,y],[x,y]]
  c: Json[];        // [x,y]
  inputs: string[]; // public inputs (string)
};
type ZoKratesProvider = {
  verify: (verificationKey: object, proof: ZoKratesProof) => boolean;
};
function isZoKratesProvider(x: unknown): x is ZoKratesProvider {
  return typeof x === "object" && x !== null && typeof (x as { verify?: unknown }).verify === "function";
}

/** ---------- Adapter ---------- */
export const zokratesGroth16: Adapter = {
  id: "zokrates-groth16",
  proofSystem: "groth16",
  framework: "zokrates",

  canHandle(input: unknown): boolean {
    return looksZoKratesGroth16(input);
  },

  async verify(input: unknown) {
    // 1) args kinyerés
    const args = extractZoKratesArgs(input);
    if (!args) {
      return { ok: false, adapter: this.id, error: "invalid_input" as const };
    }

    // 2) zokrates-js lazy import + init
    let provider: ZoKratesProvider;
    try {
      const mod = (await import("zokrates-js")) as { initialize: () => Promise<unknown> };
      const p = await mod.initialize();
      if (!isZoKratesProvider(p)) {
        return { ok: false, adapter: this.id, error: "not_implemented" as const };
      }
      provider = p;
    } catch {
      return { ok: false, adapter: this.id, error: "not_implemented" as const };
    }

    // 3) proof összeállítás ZoKrates formára
    const zkProof: ZoKratesProof = {
      a: args.proofABC.a,
      b: args.proofABC.b,
      c: args.proofABC.c,
      inputs: args.inputs,
    };

    // 4) verify (ZoKrates sync boolean)
    try {
      const verdict = provider.verify(args.vkey, zkProof);
      return verdict
        ? { ok: true, adapter: this.id }
        : { ok: false, adapter: this.id, error: "verification_failed" as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, adapter: this.id, error: msg };
    }
  },
};
