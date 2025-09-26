// ESM, strict TS, no "any" – Vector signer (CodeSeal POC)
// Signs the canonical JSON of a vector and emits { vector, seal } merged output.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stableStringify, sha256HexCanonical, toVectorUrn } from '../utils/canonical.js';
import { ensureCodeSealKeypair, signCodeSeal, type CodeSeal } from '../utils/codeSeal.js';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | Json[] | { readonly [k: string]: Json };

export type VectorsSignOptions = Readonly<{
  inPath: string;
  outPath: string;
  keyDir?: string; // optional; defaults to ~/.zkpip/key
}>;

/**
 * Reads a JSON file, canonicalizes it, computes URN, and writes { vector, seal } JSON.
 * Throws typed errors with .code for CLI to map exit codes.
 */
export async function vectorsSign(opts: VectorsSignOptions): Promise<void> {  
  const { inPath, outPath } = opts;
  const resolvedKeyDir = opts.keyDir ?? join(homedir(), '.zkpip', 'key');

  let raw: string;
  try {
    raw = await readFile(inPath, 'utf8');
  } catch (e) {
    const err = new Error(`Cannot read input: ${inPath} – ${(e as Error).message}`);
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_IO_READ';
    throw err;
  }

  let json: Json;
  try {
    json = JSON.parse(raw) as Json;
  } catch (e) {
    const err = new Error(`Input is not valid JSON: ${inPath} – ${(e as Error).message}`);
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_JSON_PARSE';
    throw err;
  }

  // Canonical string (stable key order + nested)
  const canonical = stableStringify(json);

  // Compute vector ID + URN from canonical form
  const idHex = sha256HexCanonical(json);
  const urn = toVectorUrn(idHex);

  // Ensure (or create) local ed25519 keypair
  const { privateKeyPem } = ensureCodeSealKeypair(resolvedKeyDir);

  // Sign canonical JSON
  const signature = signCodeSeal(canonical, privateKeyPem);

  const seal: CodeSeal = {
    id: idHex,
    urn,
    signer: 'codeseal-local-ed25519',
    timestamp: new Date().toISOString(),
    signature,
    algo: 'ed25519',
  };

  // Emit merged payload: { vector, seal }
  const outObj = { vector: JSON.parse(canonical) as Record<string, unknown>, seal };

  try {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(outObj, null, 2), 'utf8');
  } catch (e) {
    const err = new Error(`Cannot write output: ${outPath} – ${(e as Error).message}`);
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_IO_WRITE';
    throw err;
  }
}
