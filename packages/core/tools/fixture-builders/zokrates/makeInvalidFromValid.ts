// ESM-only; no "any"; English comments
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeFile } from '../../../src/utils/fs-compat.js';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

type Verification = {
  vk: string;
  proof: Record<string, Json>;
  inputs?: readonly string[];
  publics: readonly string[];
  meta?: { source?: string; tool?: string; note?: string };
};

function bumpDecString(s: string): string {
  // Safely increment a decimal string using BigInt
  // Non-numeric strings will throw; guard accordingly
  const trimmed = s.trim();
  if (!/^-?\d+$/.test(trimmed)) return trimmed + '1';
  const n = BigInt(trimmed);
  return (n + 1n).toString(10);
}

async function main(): Promise<void> {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i];
    const v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }

  const inPath = args.get('in');
  const outPath = args.get('out');
  if (!inPath || !outPath) {
    console.error(
      'Usage: makeInvalidFromValid.ts --in <valid.verification.json> --out <invalid.verification.json>',
    );
    process.exit(2);
  }

  const raw = await fs.readFile(inPath, 'utf8');
  const valid = JSON.parse(raw) as Verification;

  const publics = [...valid.publics];
  if (publics.length === 0) {
    throw new Error('expected at least one public signal');
  }
  publics[0] = bumpDecString(publics[0]!);

  // Keep inputs in sync if present (optional)
  const inputs: string[] | undefined = valid.inputs ? [...valid.inputs] : undefined;

  if (inputs) {
    if (inputs.length === 0) {
      throw new Error('expected at least one input');
    }
    inputs[0] = bumpDecString(inputs[0]!);
  }

  const invalid: Verification = {
    ...valid,
    publics,
    ...(inputs ? { inputs } : {}),
    meta: {
      ...(valid.meta ?? {}),
      note: 'tampered: publics[0] incremented to force verification failure',
    },
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(invalid, null, 2), 'utf8');
}

await main();
