// ESM, strict TS, no "any" — CodeSeal verifier POC.
import { readFile } from 'node:fs/promises';
import { stableStringify, sha256HexCanonical } from '../utils/canonical.js';
import { ensureCodeSealKeypair, verifyCodeSeal, type CodeSeal } from '../utils/codeSeal.js';

type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | Json[] | { readonly [k: string]: Json };

export type VectorsVerifySealOptions = Readonly<{
  inPath: string;
  keyDir?: string;
}>;

export async function vectorsVerifySeal(opts: VectorsVerifySealOptions): Promise<void> {
  const raw = await readFile(opts.inPath, 'utf8');
  const parsed = JSON.parse(raw) as { vector: Json; seal: CodeSeal };

  if (!parsed?.seal || !parsed?.vector) {
    const err = new Error('Input must contain { vector, seal }.');
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_USAGE';
    throw err;
  }
  if (parsed.seal.algo !== 'ed25519') {
    const err = new Error('Unsupported seal algo.');
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_SEAL_ALGO';
    throw err;
  }

  const canonical = stableStringify(parsed.vector);
  const idHex = sha256HexCanonical(parsed.vector);
  if (idHex !== parsed.seal.id) {
    const err = new Error('Canonical hash mismatch.');
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_SEAL_ID_MISMATCH';
    throw err;
  }

  const { publicKeyPem } = ensureCodeSealKeypair(opts.keyDir ?? `${process.env.HOME ?? ''}/.zkpip/key`);
  const ok = verifyCodeSeal(canonical, parsed.seal.signature, publicKeyPem);
  if (!ok) {
    const err = new Error('Signature invalid.');
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_SEAL_SIGNATURE';
    throw err;
  }
}
