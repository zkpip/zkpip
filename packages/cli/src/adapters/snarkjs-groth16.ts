// packages/cli/src/adapters/snarkjs-groth16.ts
import type { Adapter } from "../registry/types.js";
import { groth16 } from "snarkjs";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** ---------------- utils ---------------- */

function toLower(x: unknown): string | undefined {
  return typeof x === "string" ? x.toLowerCase() : undefined;
}
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function get<T = unknown>(o: unknown, key: string): T | undefined {
  if (!isObject(o)) return undefined;
  return (o as Record<string, unknown>)[key] as T | undefined;
}

function asLocalPath(maybeUri: string): string {
  // file://… → absolute path
  try { return fileURLToPath(maybeUri); } catch { return maybeUri; }
}

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Simple dot-path getter: "a.b.c" */
function getPath<T = unknown>(o: unknown, pathStr: string): T | undefined {
  if (!isObject(o)) return undefined;
  const parts = pathStr.split(".");
  let cur: unknown = o;
  for (const p of parts) {
    if (!isObject(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur as T | undefined;
}

/** Try a list of dot-paths; return first non-undefined */
function pickPath<T = unknown>(o: unknown, paths: string[]): T | undefined {
  for (const p of paths) {
    const v = getPath<T>(o, p);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** Convert {"0": "...", "1": "..."} into ["...","..."]; pass arrays through. */
function objLikeToArray<T = unknown>(v: unknown): T[] | undefined {
  if (Array.isArray(v)) return v as T[];
  if (!isObject(v)) return undefined;
  const numericKeys = Object.keys(v).filter((k) => /^\d+$/.test(k));
  if (!numericKeys.length) return undefined;
  const sorted = numericKeys.map(Number).sort((a, b) => a - b);
  return sorted.map((k) => (v as Record<string, unknown>)[String(k)] as T);
}

/** 1D normalization */
function norm1(v: unknown): unknown[] | undefined {
  if (Array.isArray(v)) return v as unknown[];
  return objLikeToArray(v);
}

/** 2D normalization */
function norm2(v: unknown): unknown[][] | undefined {
  const outer = norm1(v);
  if (!outer) return undefined;
  const out: unknown[][] = [];
  for (const row of outer) {
    const r = norm1(row);
    if (!r) return undefined;
    out.push(r);
  }
  return out;
}

/** Recursive find: first object that looks like a SnarkJS VK (vk_alpha_1/IC hint) */
function findVerificationKeyDeep(x: unknown, depth = 0, maxDepth = 6): unknown | undefined {
  if (depth > maxDepth) return undefined;
  if (isObject(x)) {
    if ("vk_alpha_1" in x || "vk_alfa_1" in x || "IC" in x) return x;
    for (const v of Object.values(x)) {
      const found = findVerificationKeyDeep(v, depth + 1, maxDepth);
      if (found) return found;
    }
  } else if (Array.isArray(x)) {
    for (const v of x) {
      const found = findVerificationKeyDeep(v, depth + 1, maxDepth);
      if (found) return found;
    }
  }
  return undefined;
}

const sha256Json = (x: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");

/** ---------------- detection ---------------- */

function getPublicSignalsLike(input: unknown): unknown[] | undefined {
  // Look in common places + bundle-aware + result-aware
  return (
    norm1(pickPath(input, [
      "publicSignals",
      "publicInputs",
      "inputs",
      "bundle.publicSignals",
      "bundle.publicInputs",
      "bundle.inputs",
      "result.publicSignals",
      "result.publicInputs",
      "result.inputs",
      "result.bundle.publicSignals",
      "result.bundle.publicInputs",
      "result.bundle.inputs",
    ])) ?? undefined
  );
}

/** Accept labels or shape-based fallback; tolerate "Groth16" vs "groth16", framework missing. */
function looksSnarkjsGroth16(input: unknown): boolean {
  const ps =
    toLower(pickPath(input, ["proofSystem", "meta.proofSystem", "verifier.proofSystem"])) ?? "";
  const fw =
    toLower(pickPath(input, ["framework", "meta.framework", "verifier.framework"])) ?? "";

  const rawProof = pickPath(input, [
    "proof",
    "bundle.proof",
    "result.proof",
    "result.bundle.proof",
  ]);
  const pub = getPublicSignalsLike(input);

  if (ps === "groth16" && rawProof && (fw === "" || fw === "snarkjs")) return true;

  // Shape-based fallback: we’ll try to normalize below
  if (canNormalizeProof(rawProof) && Array.isArray(pub)) return true;

  // Manifest-only (artifacts.wasm/zkey) – engedjük, az adapter fallback-kel kezelni fogja
  const a = pickPath<any>(input, ["artifacts"]);
  const hasW = isObject(a) && a.wasm !== undefined;
  const hasZ = isObject(a) && a.zkey !== undefined;
  return !!(hasW && hasZ);
}

/** ---------------- normalization ---------------- */

/** We accept proof in {pi_a,pi_b,pi_c} OR {a,b,c}, arrays or array-like objects. */
function canNormalizeProof(rawProof: unknown): boolean {
  if (!isObject(rawProof)) return false;
  return (
    get(rawProof, "pi_a") !== undefined ||
    get(rawProof, "pi_b") !== undefined ||
    get(rawProof, "pi_c") !== undefined ||
    get(rawProof, "a") !== undefined ||
    get(rawProof, "b") !== undefined ||
    get(rawProof, "c") !== undefined
  );
}

function normalizeProof(rawProof: unknown):
  | { pi_a: unknown[]; pi_b: unknown[][]; pi_c: unknown[] }
  | undefined {
  if (!isObject(rawProof)) return undefined;

  const pi_a = norm1(get(rawProof, "pi_a")) ?? norm1(get(rawProof, "a"));
  const pi_b = norm2(get(rawProof, "pi_b")) ?? norm2(get(rawProof, "b"));
  const pi_c = norm1(get(rawProof, "pi_c")) ?? norm1(get(rawProof, "c"));

  if (!pi_a || !pi_b || !pi_c) return undefined;
  return { pi_a, pi_b, pi_c };
}

function extractVKey(input: unknown): unknown | undefined {
  // Common explicit keys (bundle/verifier aware)
  const direct = pickPath(input, [
    "verificationKey",
    "vkey",
    "vk",
    "verification_key",
    "bundle.verificationKey",
    "bundle.vkey",
    "bundle.vk",
    "bundle.verification_key",
    "verifier.verificationKey",
    "verifier.vkey",
    "verifier.vk",
    "verifier.verification_key",
    "result.verificationKey",
    "result.vkey",
    "result.vk",
    "result.verification_key",
  ]);
  if (direct) return direct;

  // Heuristic deep search (handles nested VKs)
  return findVerificationKeyDeep(input);
}

/** ---------------- artifact helpers (new) ---------------- */

function readArtifactRef(art: unknown): { data: any; src: string } | undefined {
  if (!art) return undefined;
  if (typeof art === "string") {
    const p = asLocalPath(art);
    return { data: readJson(p), src: art };
  }
  if (isObject(art)) {
    const uri = get<string>(art, "uri") ?? get<string>(art, "url");
    const pth = get<string>(art, "path") ?? uri;
    if (typeof pth === "string") {
      const p = asLocalPath(pth);
      return { data: readJson(p), src: pth };
    }
  }
  return undefined;
}

function tryLoadArtifactsTriplet(artifacts: unknown): {
  vkey: any; proof: any; publicSignals: any;
  src: { vkey?: string; proof?: string; public?: string }
} | null {
  if (!isObject(artifacts)) return null;

  const v = readArtifactRef((artifacts as any).vkey);
  const p = readArtifactRef((artifacts as any).proof);
  const s = readArtifactRef((artifacts as any).publicSignals);

  if (!v || !p || !s) return null;

  const proofRaw = isObject(p.data) && "proof" in (p.data as any) ? (p.data as any).proof : p.data;
  const pubRaw = Array.isArray((p.data as any)?.publicSignals)
    ? (p.data as any).publicSignals
    : (Array.isArray(s.data) ? s.data : (s.data as any)?.publicSignals);

  if (!pubRaw || !proofRaw) return null;

  const proofNorm = normalizeProof(proofRaw);
  if (!proofNorm) return null;

  return {
    vkey: v.data,
    proof: proofNorm,
    publicSignals: pubRaw as any[],
    src: { vkey: v.src, proof: p.src, public: s.src },
  };
}

/** Normalize to SnarkJS.verify(vkey, publicSignals, proof{pi_a,pi_b,pi_c}) */
function extractArgs(
  input: unknown
): { vkey: unknown; publicSignals: unknown[]; proof: { pi_a: unknown[]; pi_b: unknown[][]; pi_c: unknown[] } } | null {
  const rawProof = pickPath(input, [
    "proof",
    "bundle.proof",
    "result.proof",
    "result.bundle.proof",
  ]);
  const publicSignals = getPublicSignalsLike(input);
  const vkey = extractVKey(input);

  if (!rawProof || !Array.isArray(publicSignals) || !vkey) return null;

  const proof = normalizeProof(rawProof);
  if (!proof) return null;

  return { vkey, publicSignals, proof };
}

/** ---------------- adapter ---------------- */

export const snarkjsGroth16: Adapter = {
  id: "snarkjs-groth16",
  proofSystem: "groth16",
  framework: "snarkjs",

  canHandle(input: unknown): boolean {
    return looksSnarkjsGroth16(input);
  },

  async verify(input: unknown) {
    const debug: any = { src: {}, hash: {}, firstPublic: undefined };

    // 1) Inline / direct fields first
    let args = extractArgs(input);
    if (args) {
      debug.src = { vkey: "inline/deep", proof: "inline", public: "inline" };
    }

    // 2) Explicit artifacts triplet (vkey/proof/publicSignals)
    if (!args) {
      const trip = tryLoadArtifactsTriplet(pickPath<any>(input, ["artifacts"]));
      if (trip) {
        args = { vkey: trip.vkey, proof: trip.proof, publicSignals: trip.publicSignals };
        debug.src = {
          vkey: trip.src.vkey ?? "artifacts.vkey",
          proof: trip.src.proof ?? "artifacts.proof",
          public: trip.src.public ?? "artifacts.publicSignals",
        };
      }
    }

    // 3) Fallback: wasm/zkey dir heuristic (legacy layout)
    if (!args) {
      const artifacts = pickPath<any>(input, ["artifacts"]);
      const zRef = isObject(artifacts) ? artifacts.zkey : undefined;
      const wRef = isObject(artifacts) ? artifacts.wasm : undefined;

      const zUri = typeof zRef === "string" ? zRef : isObject(zRef) ? (zRef.uri ?? (zRef as any).url ?? (zRef as any).path) : undefined;
      const wUri = typeof wRef === "string" ? wRef : isObject(wRef) ? (wRef.uri ?? (wRef as any).url ?? (wRef as any).path) : undefined;

      if (!zUri && !wUri) {
        return { ok: false, adapter: this.id, error: "invalid_input" };
      }

      const baseDir = path.dirname(asLocalPath(String(zUri ?? wUri)));
      const vkeyPath   = path.join(baseDir, "verification_key.json");
      const proofPath  = path.join(baseDir, "proof.json");
      const publicPath = path.join(baseDir, "public.json");

      if (!fs.existsSync(vkeyPath) || !fs.existsSync(proofPath) || !fs.existsSync(publicPath)) {
        return { ok: false, adapter: this.id, error: "missing_triplet_files" };
      }

      const vkey = readJson(vkeyPath);
      const proofFile = readJson(proofPath);
      const publicFile = readJson(publicPath);

      const composite = {
        verificationKey: vkey,
        proof: isObject(proofFile) && "proof" in (proofFile as any) ? (proofFile as any).proof : proofFile,
        publicSignals: Array.isArray((proofFile as any)?.publicSignals) ? (proofFile as any).publicSignals : publicFile,
      };

      const extracted = extractArgs(composite);
      if (!extracted) {
        const ps = Array.isArray(publicFile) ? publicFile : norm1(publicFile);
        const proofNorm = normalizeProof(
          isObject(proofFile) && "proof" in (proofFile as any) ? (proofFile as any).proof : proofFile
        );
        if (!ps || !proofNorm) {
          return { ok: false, adapter: this.id, error: "normalize_failed" };
        }
        args = { vkey, publicSignals: ps as unknown[], proof: proofNorm };
      } else {
        args = extracted;
      }

      debug.src = {
        vkey: vkeyPath,
        proof: proofPath,
        public: publicPath,
        note: "fallback-zkey-dir",
      };
    }

    if (!args) {
      return { ok: false, adapter: this.id, error: "invalid_input" };
    }

    // ---- DEBUG: what exactly are we verifying with?
    try {
      debug.hash = {
        vkey: sha256Json(args.vkey),
        proof: sha256Json(args.proof),
        public: sha256Json(args.publicSignals),
      };
      debug.firstPublic = Array.isArray(args.publicSignals) ? args.publicSignals[0] : undefined;
      if (process.env.ZKPIP_DEBUG === "1") {
        // stderr-re írunk, hogy a --json kimenet tiszta maradjon
        console.error("[groth16.verify inputs]", JSON.stringify(debug, null, 2));
      }
    } catch { /* noop */ }

    // ---- ACTUAL VERIFY
    try {
      const ok = await groth16.verify(args.vkey as any, args.publicSignals as any, args.proof as any);
      return ok
        ? { ok: true, adapter: this.id, message: "Verified by adapter: snarkjs-groth16" }
        : { ok: false, adapter: this.id, error: "verification_failed" };
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      return { ok: false, adapter: this.id, error: msg };
    }
  },
};
