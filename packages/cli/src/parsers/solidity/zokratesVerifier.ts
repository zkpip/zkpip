// ESM-only, strict TS, no "any". Parses ZoKrates verifier.sol into a raw VK object.
// The returned shape uses ZoKrates-style keys (alfa1/beta2/gamma2/delta2 + gamma_abc),
// which ZKPIP's normalizer can then convert to snarkjs shape.
//
// Supported patterns:
//   vk.alfa1 = Pairing.G1Point(x, y);
//   vk.beta2 = Pairing.G2Point([x0, x1], [y0, y1]);
//   vk.gamma2 / vk.delta2 similarly
//   vk.IC[i] = Pairing.G1Point(x, y);
//
// Notes:
// - Some templates use "alpha1" instead of "alfa1". We detect both.
// - Literals can be plain ints or uint256(...). We strip wrappers.
// - Numbers are returned as strings exactly as seen (hex or dec), normalizer will coerce.

export type NumLike = string | number | bigint;
export type G1Affine = { x: NumLike; y: NumLike };
export type G2Affine = { x: readonly [NumLike, NumLike]; y: readonly [NumLike, NumLike] };

export interface ZoVkRaw {
  alfa1?: G1Affine; // aka alpha1
  alpha1?: G1Affine; // tolerate alt naming
  beta2?: G2Affine;
  gamma2?: G2Affine;
  delta2?: G2Affine;
  gamma_abc?: readonly G1Affine[]; // IC points in order
  // Optional extras for downstream
  protocol?: 'groth16';
  curve?: 'bn128' | string;
}

function stripUintWrapper(s: string): string {
  // Remove wrappers like uint256( ... )
  return s
    .replace(/\s*uint256\s*\(\s*/g, '')
    .replace(/\s*\)\s*/g, '')
    .trim();
}

function isNumLikeStr(x: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(x) || /^[0-9]+$/.test(x);
}

function parseG1Point(src: string): G1Affine | undefined {
  const m = src.match(/Pairing\.G1Point\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/);
  if (!m) return undefined;

  const xRaw = m[1];
  const yRaw = m[2];
  if (typeof xRaw !== 'string' || typeof yRaw !== 'string') return undefined;

  const x = stripUintWrapper(xRaw);
  const y = stripUintWrapper(yRaw);
  if (!isNumLikeStr(x) || !isNumLikeStr(y)) return undefined;

  return { x, y };
}

function parseG2Point(src: string): G2Affine | undefined {
  const m = src.match(
    /Pairing\.G2Point\s*\(\s*\[\s*([^,\]]+?)\s*,\s*([^\]]+?)\s*\]\s*,\s*\[\s*([^,\]]+?)\s*,\s*([^\]]+?)\s*\]\s*\)/,
  );
  if (!m) return undefined;

  const x0Raw = m[1];
  const x1Raw = m[2];
  const y0Raw = m[3];
  const y1Raw = m[4];
  if (
    typeof x0Raw !== 'string' ||
    typeof x1Raw !== 'string' ||
    typeof y0Raw !== 'string' ||
    typeof y1Raw !== 'string'
  )
    return undefined;

  const x0 = stripUintWrapper(x0Raw);
  const x1 = stripUintWrapper(x1Raw);
  const y0 = stripUintWrapper(y0Raw);
  const y1 = stripUintWrapper(y1Raw);
  if (![x0, x1, y0, y1].every(isNumLikeStr)) return undefined;

  return { x: [x0, x1] as const, y: [y0, y1] as const };
}

function findAssign(src: string, key: string): string | undefined {
  const re = new RegExp(`vk\\.${key}\\s*=\\s*([^;]+);`);
  const m = src.match(re);
  return m ? m[1] : undefined;
}

// Safe IC parser: guards all capture groups before use
function parseIC(src: string): ReadonlyArray<G1Affine> {
  const re = /vk\.IC\[(\d+)\]\s*=\s*(Pairing\.G1Point\([^)]+\));/g;
  const map = new Map<number, G1Affine>();

  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const idxRaw = m[1];
    const ptRaw = m[2];
    if (typeof idxRaw !== 'string' || typeof ptRaw !== 'string') continue;

    const idx = Number(idxRaw);
    if (!Number.isFinite(idx) || idx < 0) continue;

    const pt = parseG1Point(ptRaw);
    if (pt) map.set(idx, pt);
  }

  if (map.size === 0) return [];

  // Build a dense array [0..max], fail fast if any IC[i] missing
  let max = -1;
  for (const k of map.keys()) if (k > max) max = k;
  if (max < 0) return [];

  const out: G1Affine[] = [];
  for (let i = 0; i <= max; i += 1) {
    const v = map.get(i);
    if (!v) throw new Error(`Missing vk.IC[${i}] in verifier.sol`);
    out.push(v);
  }
  return out;
}

/** Main entry: parse a ZoKrates verifier.sol, return ZoKrates-style VK object. */
export function parseZoKratesVerifierSol(source: string): ZoVkRaw {
  const alfa = findAssign(source, 'alfa1') ?? findAssign(source, 'alpha1');
  const beta = findAssign(source, 'beta2');
  const gamma = findAssign(source, 'gamma2');
  const delta = findAssign(source, 'delta2');

  const vk: ZoVkRaw = {};

  if (alfa) {
    const g1 = parseG1Point(alfa);
    if (g1) vk.alfa1 = g1; // keep original key; normalizer knows both
  }
  if (beta) {
    const g2 = parseG2Point(beta);
    if (g2) vk.beta2 = g2;
  }
  if (gamma) {
    const g2 = parseG2Point(gamma);
    if (g2) vk.gamma2 = g2;
  }
  if (delta) {
    const g2 = parseG2Point(delta);
    if (g2) vk.delta2 = g2;
  }

  const ic = parseIC(source);
  if (ic.length > 0) {
    vk.gamma_abc = ic;
  }

  // Hints for downstream (harmless if unused)
  vk.protocol = 'groth16';
  vk.curve = 'bn128';

  return vk;
}
