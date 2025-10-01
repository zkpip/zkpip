#!/usr/bin/env node
/**
 * Verify conformance vectors; CWD-independent.
 * - No hard process.exit(); main() returns ExitCode
 * - English comments for OSS clarity
 */

import { readdirSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ExitCode } from './utils/exit-codes.mjs';

/** Result-pattern for required args to keep helpers testable. */
function requireArgResult(name, argv) {
  // support both "--name value" and "--name=value"
  for (const tok of argv) {
    if (tok.startsWith(name + '=')) {
      const v = tok.slice(name.length + 1);
      return v ? { ok: true, value: v } : { ok: false, message: `Missing value for ${name}` };
    }
  }
  const i = argv.indexOf(name);
  const v = i >= 0 ? argv[i + 1] : undefined;
  return v ? { ok: true, value: v } : { ok: false, message: `Missing required arg: ${name}` };
}

/** Normalize possibly relative repo paths against REPO_ROOT. */
function normalizeFromRepoRoot(p, repoRoot) {
  return isAbsolute(p) ? p : resolve(repoRoot, p);
}

/** Runs CLI once; returns true on exit 0. */
function verifyOne(cliEntry, pubPath, manifestPath) {
  try {
    execFileSync(
      process.execPath,
      [cliEntry, 'manifest', 'verify', '--in', manifestPath, '--pub', pubPath, '--json', '--use-exit-codes'],
      { encoding: 'utf8' },
    );
    return true;
  } catch {
    return false;
  }
}

/** Main orchestrator. Returns ExitCode; does not exit the process. */
async function main(argv) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);
  const PKG_ROOT   = resolve(__dirname, '..');          // packages/cli
  const REPO_ROOT  = resolve(PKG_ROOT, '..', '..');     // repo root
  const CLI_ENTRY  = resolve(PKG_ROOT, 'dist', 'index.js');

  if (!existsSync(CLI_ENTRY)) {
    console.error(`[can:verify] CLI entry not found: ${CLI_ENTRY}. Did you build @zkpip/cli?`);
    return ExitCode.INVALID_ARGS;
  }

  const pubArg = requireArgResult('--pub', argv);
  if (!pubArg.ok) {
    console.error(pubArg.message);
    return ExitCode.INVALID_ARGS;
  }
  const pubPath = normalizeFromRepoRoot(pubArg.value, REPO_ROOT);

  const validDir   = resolve(REPO_ROOT, 'can/manifest/valid');
  const invalidDir = resolve(REPO_ROOT, 'can/manifest/invalid');

  const failures = [];

  for (const f of readdirSync(validDir)) {
    if (!f.endsWith('.json')) continue;
    const p = join(validDir, f);
    if (!verifyOne(CLI_ENTRY, pubPath, p)) failures.push(`expected OK: ${p}`);
  }
  for (const f of readdirSync(invalidDir)) {
    if (!f.endsWith('.json')) continue;
    const p = join(invalidDir, f);
    if (verifyOne(CLI_ENTRY, pubPath, p)) failures.push(`expected FAIL: ${p}`);
  }

  if (failures.length) {
    console.error('[can:verify] failures:\n- ' + failures.join('\n- '));
    return ExitCode.SCHEMA_INVALID;
  }

  console.log('[can:verify] all vectors behaved as expected');
  return ExitCode.OK;
}

// ── Entry: the only place that touches process.exitCode ────────────────────────
const code = await main(process.argv);
process.exitCode = code;
