// ESM script – regenerate all *.json → *.sealed.json as Seal V1 (kind=vector)
// - No hard process.exit(); main() returns ExitCode
// - English comments for OSS clarity

import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaNode } from 'execa';
import { ExitCode } from '../src/utils/exit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');              // packages/cli
const distCli = path.join(repo, 'dist', 'index.js');     // built CLI entry

// Adjust these roots to where your fixtures live:
const roots = [
  path.join(repo, 'src', '__tests__', 'fixtures'),
  // add more folders if needed
];

/** Recursively regenerate *.sealed.json next to *.json (skip already-sealed). */
async function regen(dir: string): Promise<void> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await regen(p);
      continue;
    }
    if (e.isFile() && e.name.endsWith('.json') && !e.name.endsWith('.sealed.json')) {
      const out = p.replace(/\.json$/, '.sealed.json');
      mkdirSync(path.dirname(out), { recursive: true });

      // Run CLI signer deterministically; avoid hard exit
      await execaNode(
        distCli,
        ['vectors', 'sign', '--in', p, '--out', out, '--key-dir', path.join(dir, '.keys')],
        { stdio: 'pipe', env: { ZKPIP_HARD_EXIT: '0' } },
      );

      // Sanity check the resulting URN
      const sealed = JSON.parse(readFileSync(out, 'utf8'));
      if (!sealed?.seal?.urn?.startsWith('urn:zkpip:vector:sha256:')) {
        throw new Error(`Unexpected URN in ${out}`);
      }
      console.log('OK:', out);
    }
  }
}

/** Main orchestrator — returns ExitCode, does not hard-exit. */
async function main(): Promise<ExitCode> {
  if (!existsSync(distCli)) {
    console.error(`[regen] CLI entry not found: ${distCli}. Did you build @zkpip/cli?`);
    return ExitCode.INVALID_ARGS;
  }

  for (const r of roots) {
    try {
      await regen(r);
    } catch (e) {
      console.error('[regen] FAIL in', r, (e as Error)?.message ?? String(e));
      return ExitCode.IO_ERROR;
    }
  }
  return ExitCode.OK;
}

// ── Entry: the only place that touches process.exitCode ────────────────────────
process.exitCode = await main();
