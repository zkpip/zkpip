// ESM-only; no "any"; English comments
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

type ZoProofFile = {
  proof: Record<string, Json>;
  inputs?: readonly (string | number | bigint)[];
};

type OutVerification = {
  // Adapter-friendly shape (ZoKrates Groth16)
  vk: string; // base64-encoded verification.key
  proof: Record<string, Json>;
  inputs?: readonly string[]; // keep original naming for flexibility
  publics: readonly string[]; // normalized public inputs (strings)
  meta?: { source: string; tool: string; note?: string };
};

function toStrings(arr: readonly (string | number | bigint)[] | undefined): readonly string[] {
  if (!arr) return [];
  return arr.map((v) => (typeof v === 'string' ? v : String(v)));
}

async function loadJson<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

async function main(): Promise<void> {
  // Simple argv parsing (no deps)
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }

  const proofPath = args.get('proof');
  const vkPath = args.get('vk');
  const outPath = args.get('out');

  if (!proofPath || !vkPath || !outPath) {
    console.error(
      'Usage: makeVerificationJson.ts --proof <proof.json> --vk <verification.key> --out <verification.json>',
    );
    process.exit(2);
  }

  const proofFile = await loadJson<ZoProofFile>(proofPath);
  const publics = toStrings(proofFile.inputs);
  const vkBase64 = readFileSync(vkPath).toString('base64');

  const out: OutVerification = {
    vk: vkBase64,
    proof: proofFile.proof,
    inputs: publics,
    publics,
    meta: {
      source: path.basename(proofPath),
      tool: 'zokrates (groth16)',
    },
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
}

await main();
