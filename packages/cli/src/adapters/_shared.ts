// Node ESM imports (add only if not present yet)
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type PublicsU = ReadonlyArray<string | number | bigint>;
export type VerificationKey = Record<string, unknown>;
export type ProofObj = Record<string, unknown>;

export type AutoNormalizeInput = {
  vkey?: Record<string, unknown>;
  proof?: unknown;
  publics?: ReadonlyArray<string>;
};

export type AutoNormalizeOutput = {
  value: AutoNormalizeInput;
  actions: string[];
};

// ---------- JSON file readers (no 'any'), safe for CLI/adapters ----------

/**
 * Read a JSON file from an absolute path.
 * Throws on failure (callers usually wrap in try/catch).
 */
export function readJsonFromFile(absPath: string): unknown {
  const raw = readFileSync(absPath, 'utf8');
  return JSON.parse(raw) as unknown;
}

/**
 * Try to read JSON when input is either:
 *  - an absolute path string
 *  - a relative path string (resolved against baseDir if provided)
 *  - otherwise returns undefined.
 */
export function readJsonRelative(relOrAbs: unknown, baseDir?: string): unknown {
  if (typeof relOrAbs !== 'string') return undefined;

  // Absolute path first
  if (path.isAbsolute(relOrAbs)) {
    try {
      return readJsonFromFile(relOrAbs);
    } catch {
      /* ignore */
    }
  }

  // Relative to baseDir
  if (baseDir) {
    const p = path.join(baseDir, relOrAbs);
    try {
      return readJsonFromFile(p);
    } catch {
      /* ignore */
    }
  }

  // Last resort: relative to CWD
  try {
    return readJsonFromFile(path.join(process.cwd(), relOrAbs));
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Resolve repo root by looking for a 'packages' directory when we have a path like 'packages/...'.
 * Walks up a few levels from the starting directory (baseDir or CWD).
 */
function resolveRepoRootFrom(startDir?: string): string | undefined {
  let dir = startDir ?? process.cwd();
  for (let i = 0; i < 6; i += 1) {
    // avoid runaway traversal
    const probe = path.join(dir, 'packages');
    try {
      if (existsSync(probe) && statSync(probe).isDirectory()) {
        return path.dirname(probe);
      }
    } catch {
      /* ignore */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Load JSON via an "artifact reference" object, e.g.:
 * { uri: "file:///abs/path/to/file.json" } or { path: "relative/or/absolute.json" }
 *
 * Resolution order:
 *   1) file:// URI via fileURLToPath
 *   2) absolute path
 *   3) baseDir + path (if baseDir given)
 *   4) if path starts with 'packages/', resolve repo root by searching upward for a 'packages' dir
 *   5) CWD + path
 */
export function readFromArtifactRef(ref: unknown, baseDir?: string): unknown {
  if (!isObj(ref)) return undefined;

  const uriVal = get(ref, 'uri');
  const pathVal = get(ref, 'path');

  // 1) file:// URI
  if (typeof uriVal === 'string' && uriVal.startsWith('file://')) {
    try {
      return readJsonFromFile(fileURLToPath(uriVal));
    } catch {
      /* ignore */
    }
  }

  // 2–5) path string variants
  if (typeof pathVal === 'string') {
    // Absolute path
    if (path.isAbsolute(pathVal)) {
      try {
        return readJsonFromFile(pathVal);
      } catch {
        /* ignore */
      }
    }

    // baseDir + relative path
    if (baseDir) {
      const cand = path.join(baseDir, pathVal);
      try {
        return readJsonFromFile(cand);
      } catch {
        /* ignore */
      }
    }

    // repoRoot + packages/... (when pathVal starts with 'packages/')
    if (pathVal.startsWith('packages/')) {
      const repoRoot = resolveRepoRootFrom(baseDir);
      if (repoRoot) {
        const abs = path.join(repoRoot, pathVal);
        try {
          return readJsonFromFile(abs);
        } catch {
          /* ignore */
        }
      }
    }

    // CWD + relative
    try {
      return readJsonFromFile(path.join(process.cwd(), pathVal));
    } catch {
      /* ignore */
    }
  }

  return undefined;
}

export function assertG1Tuple(t: unknown, ctx: string): asserts t is readonly [string, string] {
  if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== 'string' || typeof t[1] !== 'string') {
    throw new Error(`Invalid ${ctx}: expected [string,string]`);
  }
}

export function assertG2Tuple(
  t: unknown,
  ctx: string,
): asserts t is readonly [readonly [string, string], readonly [string, string]] {
  if (!Array.isArray(t) || t.length !== 2) throw new Error(`Invalid ${ctx}: expected [[..],[..]]`);
  const X = t[0];
  const Y = t[1];
  if (!Array.isArray(X) || X.length !== 2 || !Array.isArray(Y) || Y.length !== 2) {
    throw new Error(`Invalid ${ctx}: expected [[x0,x1],[y0,y1]]`);
  }
  if (
    typeof X[0] !== 'string' ||
    typeof X[1] !== 'string' ||
    typeof Y[0] !== 'string' ||
    typeof Y[1] !== 'string'
  ) {
    throw new Error(`Invalid ${ctx}: elements must be strings`);
  }
}

export function assertStringArray(x: unknown, ctx: string): asserts x is ReadonlyArray<string> {
  if (!Array.isArray(x) || x.some((e) => typeof e !== 'string')) {
    throw new Error(`Invalid ${ctx}: expected string[]`);
  }
}

// ---- Strict variant for places where a string is MANDATORY ----
// Always returns a decimal string or throws with a helpful context message.
export function toDecStringStrict(x: unknown, ctx: string): string {
  const s = toDecString(x);
  if (typeof s === 'string') return s;
  throw new Error(`Invalid ${ctx}: expected hex/dec string or number`);
}

function isTuple2(a: unknown): a is readonly [unknown, unknown] {
  return Array.isArray(a) && a.length === 2;
}

// ---- BN254 field arithmetic (no deps) --------------------------------------

// BN254 / altbn128 prime used by snarkjs groth16
const BN254_P = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

function modP(a: bigint): bigint {
  const r = a % BN254_P;
  return r >= 0n ? r : r + BN254_P;
}

function toBigIntField(x: unknown, ctx: string): bigint {
  if (typeof x === 'bigint') return modP(x);
  if (typeof x === 'number') return modP(BigInt(x));
  if (typeof x === 'string') {
    const s = x.trim();
    // Accept both hex (0x...) and decimal
    const n = s.startsWith('0x') || s.startsWith('0X') ? BigInt(s) : BigInt(s);
    return modP(n);
  }
  throw new Error(`Invalid ${ctx}: expected field element as string|number|bigint`);
}

// Extended Euclid for modular inverse in Fp
function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  let old_r = a,
    r = b;
  let old_s = 1n,
    s = 0n;
  let old_t = 0n,
    t = 1n;
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
    [old_t, t] = [t, old_t - q * t];
  }
  return [old_r, old_s, old_t]; // gcd, x, y → x*a + y*b = gcd
}

function invModP(a: bigint): bigint {
  const aa = modP(a);
  if (aa === 0n) throw new Error('Inverse of zero does not exist');
  const [g, x] = egcd(aa, BN254_P);
  if (g !== 1n) throw new Error('Non-invertible element in Fp');
  return modP(x);
}

// ---- Fp² arithmetic with non-residue = -1 (bn128 convention) ---------------
type Fp2 = readonly [bigint, bigint];

function f2(a0: unknown, a1: unknown, ctx: string): Fp2 {
  return [toBigIntField(a0, `${ctx}[0]`), toBigIntField(a1, `${ctx}[1]`)] as const;
}

// (a+bi) * (c+di) with u^2 = -1 → (ac - bd) + (ad + bc)i
function f2Mul(a: Fp2, b: Fp2): Fp2 {
  const ac = modP(a[0] * b[0]);
  const bd = modP(a[1] * b[1]);
  const ad = modP(a[0] * b[1]);
  const bc = modP(a[1] * b[0]);
  return [modP(ac - bd), modP(ad + bc)] as const;
}
// Inverse: (a+bi)^(-1) = (a - bi) / (a^2 + b^2)
function f2Inv(a: Fp2): Fp2 {
  const a2 = modP(a[0] * a[0]);
  const b2 = modP(a[1] * a[1]);
  const denom = modP(a2 + b2);
  const invDen = invModP(denom);
  // (a, -b) * invDen
  return [modP(a[0] * invDen), modP((BN254_P - (a[1] % BN254_P)) * invDen)] as const;
}

// ---- G1/G2 affine converters (now accept Jacobian too) ----------------------

/** Accepts [x,y], [x,y,z], {x,y}, {x,y,z} → returns [decX, decY] (strings) */
export function toG1Affine(src: unknown): G1AffineTuple {
  // [x,y,z] Jacobian → affine
  if (Array.isArray(src) && src.length === 3) {
    const X = toBigIntField(src[0], 'G1.X');
    const Y = toBigIntField(src[1], 'G1.Y');
    const Z = toBigIntField(src[2], 'G1.Z');
    if (Z === 0n) throw new Error('Invalid G1 Jacobian: Z=0');
    if (Z !== 1n) {
      const invZ = invModP(Z);
      const invZ2 = modP(invZ * invZ);
      const invZ3 = modP(invZ2 * invZ);
      const x = modP(X * invZ2).toString(10);
      const y = modP(Y * invZ3).toString(10);
      return [x, y] as const;
    }
    // Z == 1 → trivial trim
    return [X.toString(10), Y.toString(10)] as const;
  }

  // {x,y,z?}
  if (isObj(src)) {
    const obj = src as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(obj, 'z')) {
      const X = toBigIntField(obj.x, 'G1.x');
      const Y = toBigIntField(obj.y, 'G1.y');
      const Z = toBigIntField(obj.z, 'G1.z');
      if (Z === 0n) throw new Error('Invalid G1 Jacobian: Z=0');
      if (Z !== 1n) {
        const invZ = invModP(Z);
        const invZ2 = modP(invZ * invZ);
        const invZ3 = modP(invZ2 * invZ);
        const x = modP(X * invZ2).toString(10);
        const y = modP(Y * invZ3).toString(10);
        return [x, y] as const;
      }
      return [X.toString(10), Y.toString(10)] as const;
    }
    // Plain {x,y}
    const x0 = toBigIntField(obj.x, 'G1.x').toString(10);
    const y0 = toBigIntField(obj.y, 'G1.y').toString(10);
    return [x0, y0] as const;
  }

  // Legacy [x,y]
  if (isTuple2(src)) {
    const [x0, y0] = src; // <- típus: readonly [unknown, unknown]
    return [toDecStringStrict(x0, 'G1.x'), toDecStringStrict(y0, 'G1.y')] as const;
  }

  throw new Error('Invalid G1 shape');
}

/**
 * Accepts [[x0,x1],[y0,y1]], [[x0,x1],[y0,y1],[z0,z1]],
 * or {x:[x0,x1], y:[y0,y1], z?:[z0,z1]} → returns decimal strings
 */
export function toG2Affine(src: unknown): G2AffineTuple {
  // Tuple input
  if (Array.isArray(src)) {
    if (src.length === 3) {
      const Xv = src[0] as unknown;
      const Yv = src[1] as unknown;
      const Zv = src[2] as unknown;
      if (!isTuple2(Xv) || !isTuple2(Yv) || !isTuple2(Zv)) {
        throw new Error('Invalid G2 shape: expected [[x0,x1],[y0,y1],[z0,z1]]');
      }
      const X = f2(Xv[0], Xv[1], 'G2.X');
      const Y = f2(Yv[0], Yv[1], 'G2.Y');
      const Z = f2(Zv[0], Zv[1], 'G2.Z');

      // Jacobian -> affine if Z != 1
      if (!(Z[0] === 1n && Z[1] === 0n)) {
        const invZ = f2Inv(Z);
        const invZ2 = f2Mul(invZ, invZ);
        const invZ3 = f2Mul(invZ2, invZ);
        const Xp = f2Mul(X, invZ2);
        const Yp = f2Mul(Y, invZ3);
        return [
          [Xp[0].toString(10), Xp[1].toString(10)] as const,
          [Yp[0].toString(10), Yp[1].toString(10)] as const,
        ] as const;
      }
      // Z == 1
      return [
        [X[0].toString(10), X[1].toString(10)] as const,
        [Y[0].toString(10), Y[1].toString(10)] as const,
      ] as const;
    } else if (src.length === 2) {
      // [[x0,x1],[y0,y1]]
      const Xv = src[0] as unknown;
      const Yv = src[1] as unknown;
      if (!isTuple2(Xv) || !isTuple2(Yv)) {
        throw new Error('Invalid G2 shape: expected [[x0,x1],[y0,y1]]');
      }
      const X = f2(Xv[0], Xv[1], 'G2.X');
      const Y = f2(Yv[0], Yv[1], 'G2.Y');
      return [
        [X[0].toString(10), X[1].toString(10)] as const,
        [Y[0].toString(10), Y[1].toString(10)] as const,
      ] as const;
    } else {
      throw new Error('Invalid G2 tuple shape');
    }
  }

  // Object with possible z: {x:[x0,x1], y:[y0,y1], z?:[z0,z1]}
  if (isObj(src)) {
    const obj = src as Record<string, unknown>;
    const xv = obj.x as unknown;
    const yv = obj.y as unknown;
    if (!Array.isArray(xv) || !Array.isArray(yv) || !isTuple2(xv) || !isTuple2(yv)) {
      throw new Error('Invalid G2 object shape');
    }
    const X = f2(xv[0], xv[1], 'G2.X');
    const Y = f2(yv[0], yv[1], 'G2.Y');

    if (Object.prototype.hasOwnProperty.call(obj, 'z')) {
      const zv = obj.z as unknown;
      if (!Array.isArray(zv) || !isTuple2(zv)) {
        throw new Error('Invalid G2.z shape');
      }
      const Z = f2(zv[0], zv[1], 'G2.Z');

      if (!(Z[0] === 1n && Z[1] === 0n)) {
        const invZ = f2Inv(Z);
        const invZ2 = f2Mul(invZ, invZ);
        const invZ3 = f2Mul(invZ2, invZ);
        const Xp = f2Mul(X, invZ2);
        const Yp = f2Mul(Y, invZ3);
        return [
          [Xp[0].toString(10), Xp[1].toString(10)] as const,
          [Yp[0].toString(10), Yp[1].toString(10)] as const,
        ] as const;
      }
    }

    // No z or z == 1
    return [
      [X[0].toString(10), X[1].toString(10)] as const,
      [Y[0].toString(10), Y[1].toString(10)] as const,
    ] as const;
  }

  throw new Error('Invalid G2 shape');
}

export function parseJsonIfString(x: unknown): unknown {
  if (typeof x === 'string') {
    const s = x.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return JSON.parse(s);
      } catch {
        /* ignore */
      }
    }
  }
  return x;
}

export function toArrayFromMaybeString(x: unknown): unknown[] | undefined {
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') {
    const parsed = parseJsonIfString(x);
    if (Array.isArray(parsed)) return parsed;
    const parts = x
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
}

// replace normalizePublicSignals with this
export function normalizePublicSignals(x: unknown): ReadonlyArray<PublicSignal> {
  const arr = toArrayFromMaybeString(x) ?? (Array.isArray(x) ? x : []);
  const out: PublicSignal[] = [];
  for (const v of arr) {
    if (typeof v === 'string') {
      out.push(v.startsWith('0x') || v.startsWith('0X') ? BigInt(v).toString(10) : v);
    } else if (typeof v === 'number') {
      out.push(BigInt(v).toString(10));
    } else if (typeof v === 'bigint') {
      out.push(v.toString(10));
    } else {
      // invalid elem esetén üres tömb -> upstream adapter_error/verification_failed
      return [];
    }
  }
  return out;
}

// ---- Field & publics normalizer (hex→dec), no "any", exactOptionalPropertyTypes-safe

export type NormalizationReport = {
  readonly detected?: {
    readonly framework?: 'snarkjs' | 'zokrates' | 'unknown';
    readonly proofSystem?: 'groth16' | 'plonk' | 'unknown';
    readonly source?: 'dir' | 'file' | 'inline' | 'unknown';
  };
  readonly actions: readonly string[]; // e.g. ["publics:hex→dec(2)", "vk:gamma_abc→vk_ic", "vk:G1/G2→Jacobian"]
};

function isHex(s: string): boolean {
  return /^0x[0-9a-f]+$/i.test(s);
}

export function toDecString(x: unknown): string | undefined {
  if (typeof x === 'string') {
    const s = x.trim();
    if (isHex(s)) return BigInt(s).toString(10);
    if (/^[0-9]+$/.test(s)) return s;
  } else if (typeof x === 'bigint' || typeof x === 'number') {
    try {
      return BigInt(x).toString(10);
    } catch {
      /*noop*/
    }
  }
  return undefined;
}

export function coercePublics(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    const d = toDecString(v);
    if (typeof d === 'string') out.push(d);
  }
  return out;
}

// ---- G1/G2 helpers (Jacobian completion for snarkjs)
type G1 = readonly [string, string];
type G2 = readonly [readonly [string, string], readonly [string, string]];

export function g1ToJac(p: G1) {
  return [p[0], p[1], '1'] as const;
}
export function g2ToJac(p: G2) {
  return [
    [p[0][0], p[0][1]],
    [p[1][0], p[1][1]],
    ['1', '0'],
  ] as const;
}

// ---- Adapter-targeted auto-normalize
export type ExtractedCommon = {
  vkey?: Record<string, unknown>;
  proof?: unknown;
  publics?: readonly string[];
};

// --- safe shape guards / converters (no 'any')
export function asG1(x: unknown): G1 {
  if (Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string') {
    // as const → readonly tuple
    return [x[0], x[1]] as const;
  }
  throw new Error('invalid G1 point shape');
}

export function asG2(x: unknown): G2 {
  if (
    Array.isArray(x) &&
    x.length === 2 &&
    Array.isArray(x[0]) &&
    x[0].length === 2 &&
    typeof x[0][0] === 'string' &&
    typeof x[0][1] === 'string' &&
    Array.isArray(x[1]) &&
    x[1].length === 2 &&
    typeof x[1][0] === 'string' &&
    typeof x[1][1] === 'string'
  ) {
    // normalizáljuk readonly tuple-re
    return [[x[0][0], x[0][1]] as const, [x[1][0], x[1][1]] as const] as const;
  }
  throw new Error('invalid G2 point shape');
}

export function asG1Array(xs: unknown): readonly G1[] {
  if (!Array.isArray(xs)) throw new Error('invalid IC (not array)');
  const out: G1[] = [];
  for (const el of xs) out.push(asG1(el));
  return out;
}

// --- Public signals canonical type ---
export type PublicSignals = ReadonlyArray<string | number | bigint>;

// Triplet with optional keys, but WITHOUT undefined in their types
export type Triplet<PS extends ReadonlyArray<unknown> = ReadonlyArray<string | number | bigint>> = {
  vkey?: Record<string, unknown>;
  proof?: unknown;
  publics?: PS;
};

/**
 * Build a Triplet object without emitting undefined-valued keys.
 * This respects `exactOptionalPropertyTypes: true`.
 */
export function buildTriplet<PS extends ReadonlyArray<unknown>>(input: {
  vkey?: Record<string, unknown>;
  proof?: unknown;
  publics?: PS;
}): Triplet<PS> {
  // Include a key only when it's actually defined and non-empty (exactOptionalPropertyTypes-friendly)
  return {
    ...(input.vkey ? { vkey: input.vkey } : {}),
    ...(typeof input.proof !== 'undefined' ? { proof: input.proof } : {}),
    ...(input.publics && input.publics.length > 0 ? { publics: input.publics } : {}),
  };
}

export function autoNormalizeForAdapter<TID extends string>(
  adapterId: TID,
  ex: ExtractedCommon,
): { value: ExtractedCommon; report: NormalizationReport } {
  const actions: string[] = [];

  // Local working copies
  let vkey: Record<string, unknown> | undefined = ex.vkey;
  let proof: unknown = ex.proof;
  let publics: ReadonlyArray<string> | undefined = ex.publics;

  // 1) Publics: try auto-extract from proof, then hex -> dec strings
  if (!publics || publics.length === 0) {
    const tryArr = isObj(proof)
      ? (get(proof, 'inputs') ?? get(proof, 'publicSignals') ?? get(proof, 'public'))
      : undefined;
    const coerced = coercePublics(tryArr);
    if (coerced.length > 0) {
      publics = coerced;
      actions.push(`publics:auto-extract(${coerced.length})`);
    }
  }
  if (publics && publics.some((s) => isHex(s))) {
    const dec = publics.map((s) => (isHex(s) ? BigInt(s).toString(10) : s));
    publics = dec;
    actions.push(`publics:hex→dec(${dec.length})`);
  }

  // --- ZoKrates Groth16 → snarkjs mapping ----------------------------------
  if (adapterId === 'zokrates-groth16') {
    // VK: ZoKrates-native -> snarkjs fields
    const hasZoVk =
      vkey &&
      (get(vkey, 'gamma_abc') != null || (get(vkey, 'alpha') != null && get(vkey, 'beta') != null));
    if (hasZoVk && vkey) {
      const gammaAbc = get(vkey, 'gamma_abc') as unknown;
      // Map gamma_abc[] (G1 objects) -> IC[][2]
      if (Array.isArray(gammaAbc)) {
        const IC = gammaAbc
          .map((p) => toG1Affine(p as unknown))
          .filter((p): p is readonly [string, string] => Array.isArray(p) && p.length === 2);
        if (IC.length === gammaAbc.length) {
          vkey = {
            ...(vkey as Record<string, unknown>),
            vk_alpha_1: toG1Affine(get(vkey, 'alpha') as unknown),
            vk_beta_2: toG2Affine(get(vkey, 'beta') as unknown),
            vk_gamma_2: toG2Affine(get(vkey, 'gamma') as unknown),
            vk_delta_2: toG2Affine(get(vkey, 'delta') as unknown),
            IC,
          };
          actions.push('vk:zokrates→snarkjs', 'vk:G1/G2→affine');
        }
      }
    } else if (vkey) {
      // Already snarkjs-ish: ensure points are affine arrays
      const vk1 = toG1Affine(get(vkey, 'vk_alpha_1') as unknown);
      const vb2 = toG2Affine(get(vkey, 'vk_beta_2') as unknown);
      const vg2 = toG2Affine(get(vkey, 'vk_gamma_2') as unknown);
      const vd2 = toG2Affine(get(vkey, 'vk_delta_2') as unknown);
      const icRaw = get(vkey, 'IC') as unknown;
      const ic = Array.isArray(icRaw) ? icRaw.map((p) => toG1Affine(p as unknown)) : undefined;
      if (vk1 || vb2 || vg2 || vd2 || ic) {
        vkey = {
          ...(vkey as Record<string, unknown>),
          ...(vk1 ? { vk_alpha_1: vk1 } : {}),
          ...(vb2 ? { vk_beta_2: vb2 } : {}),
          ...(vg2 ? { vk_gamma_2: vg2 } : {}),
          ...(vd2 ? { vk_delta_2: vd2 } : {}),
          ...(ic ? { IC: ic } : {}),
        };
        actions.push('vk:G1/G2→affine');
      }
    }

    // Proof: ZoKrates-native a/b/c -> snarkjs pi_a/b/c
    if (proof && typeof proof === 'object') {
      const a = get(proof as Record<string, unknown>, 'a') as unknown;
      const b = get(proof as Record<string, unknown>, 'b') as unknown;
      const c = get(proof as Record<string, unknown>, 'c') as unknown;
      if (a || b || c) {
        const pi_a = toG1Affine(a);
        const pi_b = toG2Affine(b);
        const pi_c = toG1Affine(c);
        proof = { pi_a, pi_b, pi_c };
        actions.push('proof:zokrates→snarkjs', 'proof:G1/G2→affine');
      } else {
        // Already snarkjs-ish -> still ensure affine
        const pi_a = toG1Affine(get(proof as Record<string, unknown>, 'pi_a') as unknown);
        const pi_b = toG2Affine(get(proof as Record<string, unknown>, 'pi_b') as unknown);
        const pi_c = toG1Affine(get(proof as Record<string, unknown>, 'pi_c') as unknown);
        if (pi_a || pi_b || pi_c) {
          proof = {
            ...(proof as Record<string, unknown>),
            ...(pi_a ? { pi_a } : {}),
            ...(pi_b ? { pi_b } : {}),
            ...(pi_c ? { pi_c } : {}),
          };
          actions.push('proof:G1/G2→affine');
        }
      }
    }
  }

  // 3) VK normalization for snarkjs Groth16 (aliases/object -> affine tuples + IC + nPublic)
  if (adapterId === 'snarkjs-groth16') {
    if (vkey && isObj(vkey)) {
      const icSrc = (get(vkey, 'IC') ??
        get(vkey, 'vk_ic') ??
        get(vkey, 'ic') ??
        get(vkey, 'gamma_abc')) as unknown;
      const alphaSrc = (get(vkey, 'vk_alpha_1') ??
        get(vkey, 'alpha1') ??
        get(vkey, 'alpha')) as unknown;
      const betaSrc = (get(vkey, 'vk_beta_2') ??
        get(vkey, 'beta2') ??
        get(vkey, 'beta')) as unknown;
      const gammaSrc = (get(vkey, 'vk_gamma_2') ??
        get(vkey, 'gamma2') ??
        get(vkey, 'gamma')) as unknown;
      const deltaSrc = (get(vkey, 'vk_delta_2') ??
        get(vkey, 'delta2') ??
        get(vkey, 'delta')) as unknown;

      let IC: readonly G1AffineTuple[] | undefined;
      if (Array.isArray(icSrc)) {
        try {
          IC = (icSrc as readonly unknown[]).map(toG1Affine);
        } catch {
          /* keep */
        }
      }

      try {
        const coerced = {
          ...(alphaSrc ? { vk_alpha_1: toG1Affine(alphaSrc) } : {}),
          ...(betaSrc ? { vk_beta_2: toG2Affine(betaSrc) } : {}),
          ...(gammaSrc ? { vk_gamma_2: toG2Affine(gammaSrc) } : {}),
          ...(deltaSrc ? { vk_delta_2: toG2Affine(deltaSrc) } : {}),
          ...(IC ? { IC } : {}),
        } as Record<string, unknown>;

        if (Object.keys(coerced).length > 0) {
          vkey = { ...(vkey as Record<string, unknown>), ...coerced };
          const acts: string[] = ['vk:affine→dec'];
          if (IC) acts.push('vk:+IC');
          actions.push(...acts);
        }

        if (!get(vkey, 'nPublic')) {
          const np =
            publics && publics.length > 0
              ? publics.length
              : Array.isArray(get(vkey, 'IC'))
                ? (get(vkey, 'IC') as unknown[]).length - 1
                : undefined;
          if (typeof np === 'number' && Number.isFinite(np) && np >= 0) {
            vkey = { ...(vkey as Record<string, unknown>), nPublic: np };
            actions.push('vk:+nPublic');
          }
        }
      } catch {
        /* keep original VK if coercion fails */
      }
    }
  }

  if (adapterId === 'snarkjs-plonk') {
    if (vkey && publics && get(vkey, 'nPublic') == null) {
      vkey = { ...(vkey as Record<string, unknown>), nPublic: publics.length };
      actions.push('vk:+nPublic');
    }
    if (typeof proof !== 'string') {
      const pObj =
        proof && typeof proof === 'object' ? (proof as Record<string, unknown>) : undefined;
      const hexCandidate = pObj ? get(pObj, 'proof') : undefined;
      if (typeof hexCandidate === 'string') {
        proof = hexCandidate;
        actions.push('proof:object→hex');
      }
    }
  }

  // 4) Proof normalization (handle both snarkjs-shaped pi_* and affine a,b,c) — apply to both adapters
  if (isObj(proof)) {
    const pObj = ((): Record<string, unknown> => {
      const inner = get(proof, 'proof');
      return isObj(inner) ? (inner as Record<string, unknown>) : (proof as Record<string, unknown>);
    })();

    // Prefer snarkjs-shaped keys if present
    const pi_a = get(pObj, 'pi_a') as unknown;
    const pi_b = get(pObj, 'pi_b') as unknown;
    const pi_c = get(pObj, 'pi_c') as unknown;

    if (Array.isArray(pi_a) && Array.isArray(pi_b) && Array.isArray(pi_c)) {
      try {
        // Accept Jacobian/object inputs; toG1/G2Affine elvégzi az affinizálást (Z≠1 esetén is)
        const norm = {
          pi_a: toG1Affine(pi_a),
          pi_b: toG2Affine(pi_b),
          pi_c: toG1Affine(pi_c),
        } as const;
        proof = norm;
        actions.push('proof:pi_*→affine dec');
      } catch {
        /* keep original, try a/b/c below */
      }
    } else {
      // Fallback: ZoKrates/other style a,b,c
      const a = get(pObj, 'a') as unknown;
      const b = get(pObj, 'b') as unknown;
      const c = get(pObj, 'c') as unknown;

      if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c)) {
        try {
          const norm = {
            pi_a: toG1Affine(a),
            pi_b: toG2Affine(b),
            pi_c: toG1Affine(c),
          } as const;
          proof = norm;
          actions.push('proof:a,b,c→pi_* (affine dec)');
        } catch {
          /* keep proof as-is */
        }
      }
    }
  }

  const value: ExtractedCommon = {
    ...(vkey ? { vkey } : {}),
    ...(typeof proof !== 'undefined' ? { proof } : {}),
    ...(publics ? { publics } : {}),
  } as ExtractedCommon;

  const report: NormalizationReport = { actions };

  return { value, report };
}

/** ---------- Public types ---------- */
export type PublicSignal = string | number | bigint;

/** ---------- Tiny type guards & getters ---------- */
export function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function get<T = unknown>(o: unknown, key: string): T | undefined {
  if (!isObj(o)) return undefined;
  return (o as Record<string, unknown>)[key] as T | undefined;
}

export function getPath(o: unknown, path: string): unknown {
  if (!isObj(o)) return undefined;
  const parts = path.split('.');
  let cur: unknown = o;
  for (const p of parts) {
    if (!isObj(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** ---------- Generic deep-search helpers ---------- */
export function deepFindFirst(root: unknown, pred: (x: unknown) => boolean): unknown | undefined {
  const seen = new Set<unknown>();
  function walk(node: unknown): unknown | undefined {
    if (node === null || typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const el of node) {
        const got = walk(el);
        if (got !== undefined) return got;
      }
      return undefined;
    }
    if (pred(node)) return node;
    for (const val of Object.values(node as Record<string, unknown>)) {
      const got = walk(val);
      if (got !== undefined) return got;
    }
    return undefined;
  }
  return walk(root);
}

export function deepFindByKeys(root: unknown, keys: readonly string[]): unknown | undefined {
  const seen = new Set<unknown>();
  function walk(node: unknown): unknown | undefined {
    if (node === null || typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const el of node) {
        const got = walk(el);
        if (got !== undefined) return got;
      }
      return undefined;
    }
    const obj = node as Record<string, unknown>;
    for (const k of keys) {
      if (obj[k] !== undefined) return obj[k];
    }
    for (const val of Object.values(obj)) {
      const got = walk(val);
      if (got !== undefined) return got;
    }
    return undefined;
  }
  return walk(root);
}

export function pickFirstKey(obj: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined) return v;
  }
  return undefined;
}

/** ---------- Safe stringify, small utils ---------- */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function toLower(x: unknown): string | undefined {
  return typeof x === 'string' ? x.toLowerCase() : undefined;
}

/** ---------- ZoKrates helper ---------- */
export function ensureHexStrings(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push('0x' + v.toString(16));
    else return undefined;
  }
  return out;
}

/** ---------- Input materialization (path → JSON object) ---------- */
export function materializeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    try {
      return JSON.parse(readFileSync(input, 'utf8'));
    } catch {
      return input;
    }
  }
  if (isObj(input)) {
    const b = (input as Record<string, unknown>)['bundle'];
    const bp = (input as Record<string, unknown>)['bundlePath'];
    if (typeof b === 'string') {
      try {
        return JSON.parse(readFileSync(b, 'utf8'));
      } catch {
        /* ignore */
      }
    }
    if (typeof bp === 'string') {
      try {
        return JSON.parse(readFileSync(bp, 'utf8'));
      } catch {
        /* ignore */
      }
    }
  }
  return input;
}

/** ---------- Minimal debug (stderr, safe for --json) ---------- */
export function debug(...args: ReadonlyArray<unknown>): void {
  if (process.env.ZKPIP_DEBUG === '1') {
    console.error('[zkpip]', ...args);
  }
}

/** ---------- Affin helpers ---------- */
export type NumLike = string | number | bigint;
export type G1AffineTuple = readonly [string, string];
export type G2AffineTuple = readonly [readonly [string, string], readonly [string, string]];
