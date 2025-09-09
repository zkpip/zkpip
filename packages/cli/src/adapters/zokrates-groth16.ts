// packages/cli/src/adapters/zokrates-groth16.ts
import type { Adapter, VerifyOutcome } from '../registry/types.js';

/** ---------- JSON types (no any) ---------- */
type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | Json[] | JsonObject;
type JsonObject = { [k: string]: Json };

/** ---------- Error stringify helper ---------- */
const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : (() => { try { return JSON.stringify(err); } catch { return String(err); } })();

/** ---------- Small utils ---------- */
function toLower(x: unknown): string | undefined {
  return typeof x === 'string' ? x.toLowerCase() : undefined;
}
function isJsonObject(x: unknown): x is JsonObject {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function get<T extends Json = Json>(o: unknown, key: string): T | undefined {
  if (!isJsonObject(o)) return undefined;
  return o[key] as T | undefined;
}
function ensureHexStrings(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push('0x' + v.toString(16));
    else return undefined;
  }
  return out;
}

/** ---------- Heuristic: does input look like ZoKrates Groth16? ---------- */
function looksZoKratesGroth16(input: unknown): boolean {
  if (!isJsonObject(input)) return false;

  // inline hints
  const ps = toLower(get(input, 'proofSystem') ?? get(get(input, 'meta'), 'proofSystem'));
  const fw = toLower(get(input, 'framework') ?? get(get(input, 'meta'), 'framework'));
  if ((ps === 'groth16' && fw === 'zokrates') || fw === 'zokrates') return true;

  // inline proof shape: { proof: { a, b, c }, ... }
  const proof = get(input, 'proof') ?? get(get(input, 'bundle'), 'proof');
  const a = get<Json[]>(proof, 'a');
  const b = get<Json[][]>(proof, 'b');
  const c = get<Json[]>(proof, 'c');
  if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c)) return true;

  // artifacts-style hints (very permissive)
  const art = get(input, 'artifacts') ?? get(get(input, 'bundle'), 'artifacts');
  if (isJsonObject(art)) {
    const hasVkPath = typeof get(art, 'verificationKey') === 'string' || typeof get(art, 'vkey') === 'string';
    const hasProofPath = typeof get(art, 'proof') === 'string';
    if (hasVkPath && hasProofPath) return true;
  }

  return false;
}

/** ---------- Extraction ---------- */
type ExtractedArgs = {
  vkey: JsonObject; // ZoKrates verify 1st arg
  proofABC: { a: Json[]; b: Json[][]; c: Json[] };
  inputs: string[]; // normalized public inputs
};

function extractZoKratesArgs(input: unknown): ExtractedArgs | null {
  const vkeyRaw =
    get(input, 'verificationKey') ??
    get(get(input, 'meta'), 'verificationKey') ??
    get(input, 'vkey') ??
    get(get(input, 'bundle'), 'verificationKey');

  if (!isJsonObject(vkeyRaw)) return null;

  const proof = get(input, 'proof') ?? get(get(input, 'bundle'), 'proof');
  const a = get<Json[]>(proof, 'a');
  const b = get<Json[][]>(proof, 'b');
  const c = get<Json[]>(proof, 'c');
  if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c)) return null;

  const inputsRaw =
    get(input, 'inputs') ??
    get(input, 'publicInputs') ??
    get(get(input, 'bundle'), 'publicSignals') ??
    get(get(input, 'meta'), 'publicInputs');
  if (!Array.isArray(inputsRaw)) return null;

  const inputs = ensureHexStrings(inputsRaw);
  if (!inputs) return null;

  return { vkey: vkeyRaw, proofABC: { a, b, c }, inputs };
}

/** ---------- ZoKrates minimal typings ---------- */
type ZoKratesProof = {
  a: Json[];        // [x,y]
  b: Json[][];      // [[x,y],[x,y]]
  c: Json[];        // [x,y]
  inputs: string[]; // public inputs
};
type ZoKratesProvider = {
  verify: (verificationKey: object, proof: ZoKratesProof) => boolean | Promise<boolean>;
};
function isZoKratesProvider(x: unknown): x is ZoKratesProvider {
  return typeof x === 'object' && x !== null && typeof (x as { verify?: unknown }).verify === 'function';
}

/** ---------- Adapter implementation ---------- */
const ID = 'zokrates-groth16' as const;

export const zokratesGroth16: Adapter = {
  id: ID,
  proofSystem: 'groth16',
  framework: 'zokrates',

  canHandle(input: unknown): boolean {
    return looksZoKratesGroth16(input);
  },

  async verify(input: unknown): Promise<VerifyOutcome<typeof ID>> {
    try {
      const args = extractZoKratesArgs(input);
      if (!args) {
        return { ok: false, adapter: ID, error: 'adapter_error', message: 'Unrecognized ZoKrates groth16 bundle shape' };
      }

      // Try to lazy-load a provider; if it's not installed, fail gracefully.
      let providerUnknown: unknown;
      try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        providerUnknown = (await import('zokrates-js')).default ?? (await import('zokrates-js'));
      } catch {
        providerUnknown = undefined;
      }
      if (!isZoKratesProvider(providerUnknown)) {
        return { ok: false, adapter: ID, error: 'adapter_error', message: 'zokrates-js provider not available' };
      }

      const proof: ZoKratesProof = {
        a: args.proofABC.a,
        b: args.proofABC.b,
        c: args.proofABC.c,
        inputs: args.inputs,
      };

      const result = await providerUnknown.verify(args.vkey, proof);
      if (result === true) {
        return { ok: true, adapter: ID };
      }
      return { ok: false, adapter: ID, error: 'verification_failed' };
    } catch (err: unknown) {
      return { ok: false, adapter: ID, error: 'adapter_error', message: errorMessage(err) };
    }
  },
};
