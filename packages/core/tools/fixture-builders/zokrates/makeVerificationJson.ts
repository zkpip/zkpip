// Keep comments in English; ESM; strict TS; no "any".
import fs from 'node:fs/promises';
import path from 'node:path';

type JsonObject = { readonly [k: string]: Json };
type Json = string | number | boolean | null | JsonObject | readonly Json[];

// ZoKrates proof.json shape (typical)
type ZoProofFile = {
  readonly proof: {
    readonly a: readonly [string, string];
    readonly b: readonly [[string, string], [string, string]];
    readonly c: readonly [string, string];
  };
  readonly inputs: readonly (string | number)[]; // <= volt: readonly unknown[]
};

// SnarkJS Groth16 proof shape
type SnarkjsProof = {
  readonly pi_a: readonly [string, string, string];
  readonly pi_b: readonly [[string, string, string], [string, string, string]];
  readonly pi_c: readonly [string, string, string];
};

// VerificationEnvelope v1 (ProofEnvelope v1)
type VerificationEnvelope = {
  readonly framework: 'zokrates';
  readonly proofSystem: 'groth16';
  readonly verificationKey: JsonObject; // snarkjs-compatible VK object
  readonly proof: SnarkjsProof; // normalized proof
  readonly publics: readonly string[]; // public inputs as strings
  readonly meta?: Readonly<Record<string, string>>;
};

// --- helpers ---------------------------------------------------------------

async function loadJsonFile<T extends Json>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

function toStringArray(xs: readonly unknown[]): readonly string[] {
  // Deterministic stringification (keeps decimal if bigint present)
  return xs.map((v) => (typeof v === 'bigint' ? v.toString(10) : String(v)));
}

/** Convert ZoKrates {a,b,c} into snarkjs {pi_a,pi_b,pi_c} */
function zokratesProofToSnarkjs(p: ZoProofFile['proof']): SnarkjsProof {
  // Snarkjs expects affine coords with a trailing 1 component for each G1/G2 point
  return {
    pi_a: [p.a[0], p.a[1], '1'],
    pi_b: [
      [p.b[0][0], p.b[0][1], '1'],
      [p.b[1][0], p.b[1][1], '1'],
    ],
    pi_c: [p.c[0], p.c[1], '1'],
  };
}

function normalizeRel(p: string): string {
  return p.replace(/^\.\//, '');
}

// --- main ------------------------------------------------------------------

/**
 * Build ProofEnvelope v1 JSON from ZoKrates artifacts.
 * Required inputs:
 *  - proofPath: path to ZoKrates proof.json
 *  - vkeyJsonPath: path to verification_key.json (snarkjs-compatible)
 *  - outFile: where to write verification.json (envelope v1)
 */
export async function buildVerificationEnvelope(opts: {
  readonly proofPath: string;
  readonly vkeyJsonPath: string;
  readonly outFile: string;
  readonly sourceDir?: string; // optional metadata
}): Promise<void> {
  const proofFile = await loadJsonFile<ZoProofFile>(opts.proofPath);
  const verificationKey = await loadJsonFile<JsonObject>(opts.vkeyJsonPath);

  const publics = toStringArray(proofFile.inputs);
  const proof = zokratesProofToSnarkjs(proofFile.proof);

  const envelope: VerificationEnvelope = {
    framework: 'zokrates',
    proofSystem: 'groth16',
    verificationKey,
    proof,
    publics,
    meta: {
      source: path.basename(normalizeRel(opts.proofPath)),
      tool: 'zokrates (groth16)',
      ...(opts.sourceDir ? { sourceDir: normalizeRel(opts.sourceDir) } : {}),
    },
  };

  await fs.writeFile(opts.outFile, JSON.stringify(envelope, null, 2) + '\n', 'utf8');
}

// CLI entry (if you run via tsx):
if (import.meta.url === `file://${process.argv[1]}`) {
  // args: --proof <file> --vk <file> --out <file> [--source <dir>]
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }
  const proofPath = args.get('proof');
  const vkeyJsonPath = args.get('vk');
  const outFile = args.get('out');
  const source = args.get('source');

  if (!proofPath || !vkeyJsonPath || !outFile) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: tsx makeVerificationJson.ts --proof <proof.json> --vk <verification_key.json> --out <verification.json> [--source <dir>]',
    );
    process.exit(2);
  }

  await buildVerificationEnvelope({
    proofPath,
    vkeyJsonPath,
    outFile,
    sourceDir: source,
  });
}
