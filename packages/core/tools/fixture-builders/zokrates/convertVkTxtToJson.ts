// ESM, strict TS, no "any".
// ZoKrates verification.key -> snarkjs-compatible verification_key.json
import { readFile } from 'node:fs/promises';
import { writeFile } from '../../../src/utils/fs-compat.js';
// ---- Types -----------------------------------------------------------------
type Fq = string; // decimal or 0x-hex
type Fq2 = readonly [Fq, Fq];
type G1Affine = readonly [string, string, '1'];
type G2Affine = readonly [Fq2, Fq2, readonly ['1', '0']];

type SnarkVk = {
  readonly protocol: 'groth16';
  readonly curve: 'bn128';
  readonly vk_alpha_1: G1Affine;
  readonly vk_beta_2: G2Affine;
  readonly vk_gamma_2: G2Affine;
  readonly vk_delta_2: G2Affine;
  readonly IC: readonly G1Affine[];
};

// ZoKrates 0.8.x JSON VK shape
type ZoVkJson = {
  readonly scheme: 'g16' | string;
  readonly curve: 'bn128' | string;
  readonly alpha: readonly [Fq, Fq];
  readonly beta: readonly [readonly [Fq, Fq], readonly [Fq, Fq]];
  readonly gamma: readonly [readonly [Fq, Fq], readonly [Fq, Fq]];
  readonly delta: readonly [readonly [Fq, Fq], readonly [Fq, Fq]];
  readonly gamma_abc: readonly (readonly [Fq, Fq])[];
};

// ---- Helpers ---------------------------------------------------------------
function dec(x: Fq): string {
  // Normalize to decimal strings (snarkjs-friendly)
  return x.startsWith('0x') || x.startsWith('0X') ? BigInt(x).toString(10) : x;
}
function toG1(x: Fq, y: Fq): G1Affine {
  return [dec(x), dec(y), '1'];
}
function toG2(x0: Fq, x1: Fq, y0: Fq, y1: Fq): G2Affine {
  return [
    [dec(x0), dec(x1)],
    [dec(y0), dec(y1)],
    ['1', '0'],
  ];
}
function norm(s: string): string {
  return s.replace(/\r/g, '');
}
function intsAfterTag(src: string, tag: string, needed: number): readonly Fq[] | undefined {
  const i = src.toLowerCase().indexOf(tag.toLowerCase());
  if (i < 0) return undefined;
  const slice = src.slice(i);
  const nums = Array.from(slice.matchAll(/0x[0-9a-fA-F]+|\d+/g)).map((m) => m[0]!);
  return nums.length >= needed ? nums.slice(0, needed) : undefined;
}
function matchLine2(src: string, re: RegExp): readonly Fq[] | undefined {
  const m = re.exec(src);
  return m ? [m[1]!, m[2]!] : undefined;
}
function matchLine4(src: string, re: RegExp): readonly Fq[] | undefined {
  const m = re.exec(src);
  return m ? [m[1]!, m[2]!, m[3]!, m[4]!] : undefined;
}

// ---- JSON path first -------------------------------------------------------
function isZoVkJson(o: unknown): o is ZoVkJson {
  if (!o || typeof o !== 'object') return false;
  const z = o as Record<string, unknown>;
  return (
    Array.isArray(z.alpha) &&
    Array.isArray(z.beta) &&
    Array.isArray(z.gamma) &&
    Array.isArray(z.delta) &&
    Array.isArray(z.gamma_abc)
  );
}

function fromZoJson(j: ZoVkJson): SnarkVk {
  const alpha = j.alpha;
  const b = j.beta;
  const g = j.gamma;
  const d = j.delta;
  const icPairs = j.gamma_abc;

  const IC = icPairs.map((p) => toG1(p[0]!, p[1]!));
  return {
    protocol: 'groth16',
    curve: 'bn128',
    vk_alpha_1: toG1(alpha[0]!, alpha[1]!),
    vk_beta_2: toG2(b[0]![0]!, b[0]![1]!, b[1]![0]!, b[1]![1]!),
    vk_gamma_2: toG2(g[0]![0]!, g[0]![1]!, g[1]![0]!, g[1]![1]!),
    vk_delta_2: toG2(d[0]![0]!, d[0]![1]!, d[1]![0]!, d[1]![1]!),
    IC,
  };
}

// ---- Text/regex fallback (vk.alpha_1 / vk_alpha_1 / IC / gamma_abc / query) -
function parseICArray(src: string): readonly G1Affine[] | undefined {
  const reIcLine =
    /vk[._]?ic\s*\[\s*\d+\s*\]\s*[:=]\s*(?:G1\s*)?\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)/gi;
  const byLines: G1Affine[] = [];
  for (const m of src.matchAll(reIcLine)) byLines.push(toG1(m[1]!, m[2]!));
  if (byLines.length > 0) return byLines;

  const reBlock = /(vk[._]?ic|ic|gamma_abc|query)\s*[:=]\s*\[\s*([\s\S]*?)\s*\]/i;
  const mb = src.match(reBlock);
  if (mb) {
    const body = mb[2]!;
    const reG1 = /G1\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)/g;
    const outG1: G1Affine[] = [];
    for (const p of body.matchAll(reG1)) outG1.push(toG1(p[1]!, p[2]!));
    if (outG1.length > 0) return outG1;

    const rePair = /\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)/g;
    const out: G1Affine[] = [];
    for (const p of body.matchAll(rePair)) out.push(toG1(p[1]!, p[2]!));
    if (out.length > 0) return out;
  }

  const idx =
    src.toLowerCase().indexOf('vk.ic') >= 0
      ? src.toLowerCase().indexOf('vk.ic')
      : src.toLowerCase().indexOf('vk_ic');
  if (idx >= 0) {
    const tail = src.slice(idx);
    const out: G1Affine[] = [];
    const reG1 = /G1\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)/g;
    for (const p of tail.matchAll(reG1)) out.push(toG1(p[1]!, p[2]!));
    if (out.length > 0) return out;
  }
  return undefined;
}

// ---- Main ------------------------------------------------------------------
export async function convertVkTxtToJson(opts: {
  readonly inFile: string;
  readonly outFile: string;
}): Promise<void> {
  const raw = norm(await readFile(opts.inFile, 'utf8'));

  // 1) Try JSON first
  if (raw.trim().startsWith('{')) {
    const parsed = JSON.parse(raw) as unknown;
    if (isZoVkJson(parsed)) {
      const vk = fromZoJson(parsed);
      await writeFile(opts.outFile, JSON.stringify(vk, null, 2) + '\n', 'utf8');
      return;
    }
    // falls through to text parser if shape unexpected
  }

  // 2) Text/regex fallback
  const alpha =
    matchLine2(
      raw,
      /vk[._]alpha_1\s*[:=]\s*(?:G1\s*)?\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)/i,
    ) ?? intsAfterTag(raw, 'alpha', 2);
  if (!alpha) throw new Error('cannot parse alpha (vk.alpha_1)');

  const beta =
    matchLine4(
      raw,
      /vk[._]beta_2\s*[:=]\s*(?:G2\s*)?\(\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)\s*,\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)\s*\)/i,
    ) ?? intsAfterTag(raw, 'beta', 4);
  if (!beta) throw new Error('cannot parse beta (vk.beta_2)');

  const gamma =
    matchLine4(
      raw,
      /vk[._]gamma_2\s*[:=]\s*(?:G2\s*)?\(\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)\s*,\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)\s*\)/i,
    ) ?? intsAfterTag(raw, 'gamma', 4);
  if (!gamma) throw new Error('cannot parse gamma (vk.gamma_2)');

  const delta =
    matchLine4(
      raw,
      /vk[._]delta_2\s*[:=]\s*(?:G2\s*)?\(\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)\s*,\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\)\s*\)/i,
    ) ?? intsAfterTag(raw, 'delta', 4);
  if (!delta) throw new Error('cannot parse delta (vk.delta_2)');

  const IC = parseICArray(raw);
  if (!IC || IC.length === 0) throw new Error('cannot parse IC/gamma_abc/query array');

  const vk: SnarkVk = {
    protocol: 'groth16',
    curve: 'bn128',
    vk_alpha_1: toG1(alpha[0]!, alpha[1]!),
    vk_beta_2: toG2(beta[0]!, beta[1]!, beta[2]!, beta[3]!),
    vk_gamma_2: toG2(gamma[0]!, gamma[1]!, gamma[2]!, gamma[3]!),
    vk_delta_2: toG2(delta[0]!, delta[1]!, delta[2]!, delta[3]!),
    IC,
  };
  await writeFile(opts.outFile, JSON.stringify(vk, null, 2) + '\n', 'utf8');
}

// CLI (tsx)
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }
  const inFile = args.get('in');
  const outFile = args.get('out');
  if (!inFile || !outFile) {
    console.error(
      'Usage: tsx convertVkTxtToJson.ts --in <verification.key> --out <verification_key.json>',
    );
    process.exit(2);
  }
  await convertVkTxtToJson({ inFile, outFile });
}
