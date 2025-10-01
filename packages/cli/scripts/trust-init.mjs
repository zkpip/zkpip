#!/usr/bin/env node
/**
 * Create trust/keys.json from a given keyId using the keystore.
 * Usage: npm -w @zkpip/cli run trust:init -- <keyId>
 * - No hard process.exit(); main() returns ExitCode
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { writeFileSync } from '#fs-compat';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExitCode } from './utils/exit-codes.mjs';

/** @param {readonly string[]} argv */
async function main(argv) {
  const keyId = argv[2];
  if (!keyId) {
    console.error('Usage: trust-init.mjs <keyId>');
    return ExitCode.INVALID_ARGS;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const PKG_ROOT = resolve(__dirname, '..');                 // packages/cli
  const CLI_ENTRY = resolve(PKG_ROOT, 'dist', 'index.js');   // built CLI
  const TRUST_DIR = resolve(PKG_ROOT, '..', '..', 'trust');  // repo-root/trust

  if (!existsSync(CLI_ENTRY)) {
    console.error(`[trust-init] CLI entry not found: ${CLI_ENTRY}. Did you build @zkpip/cli?`);
    return ExitCode.INVALID_ARGS;
  }

  let json;
  try {
    // Prefer absolute CLI entry (independent of PATH)
    json = execFileSync(process.execPath, [CLI_ENTRY, 'keys', 'show', '--key-id', keyId, '--json'], {
      encoding: 'utf8',
    });
  } catch (err) {
    const msg =
      (/** @type {any} */ (err))?.stderr?.toString?.() ||
      (/** @type {Error} */ (err))?.message ||
      String(err);
    console.error(`[trust-init] Failed to run CLI: ${msg}`);
    return ExitCode.UNEXPECTED;
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    console.error('[trust-init] Invalid JSON from keystore CLI:', e?.message ?? String(e));
    return ExitCode.IO_ERROR;
  }

  if (!parsed?.publicPemPath || typeof parsed.publicPemPath !== 'string') {
    console.error('[trust-init] Could not resolve publicPemPath from keystore JSON.');
    return ExitCode.SCHEMA_INVALID;
  }

  try {
    mkdirSync(TRUST_DIR, { recursive: true });
    const trustPath = resolve(TRUST_DIR, 'keys.json');
    const trust = { keys: [{ keyId, publicPemPath: parsed.publicPemPath }] };
    writeFileSync(trustPath, JSON.stringify(trust, null, 2) + '\n', 'utf8');
    console.log(`[trust:init] wrote ${trustPath}`);
  } catch (e) {
    console.error('[trust-init] Failed to write trust file:', e?.message ?? String(e));
    return ExitCode.IO_ERROR;
  }

  return ExitCode.OK;
}

// ── Entry: the only place that touches process.exitCode ────────────────────────
const code = await main(process.argv);
process.exitCode = code;
