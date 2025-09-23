#!/usr/bin/env node
/**
 * Create trust/keys.json from a given keyId using the keystore.
 * Usage: npm -w @zkpip/cli run trust:init -- <keyId>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { writeFileSync } from '#fs-compat';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const keyId = process.argv[2];
if (!keyId) {
  console.error('Usage: trust-init.mjs <keyId>');
  process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');                 // packages/cli
const CLI_ENTRY = resolve(PKG_ROOT, 'dist', 'index.js');   // built CLI
const TRUST_DIR = resolve(PKG_ROOT, '..', '..', 'trust');  // repo-root/trust

function runCli(args) {
  // Prefer absolute CLI entry (independent of PATH)
  if (!existsSync(CLI_ENTRY)) {
    console.error(`[trust-init] CLI entry not found: ${CLI_ENTRY}. Did you build @zkpip/cli?`);
    process.exit(2);
  }
  return execFileSync(process.execPath, [CLI_ENTRY, ...args], { encoding: 'utf8' });
}

const json = runCli(['keys', 'show', '--key-id', keyId, '--json']);
const parsed = JSON.parse(json);
if (!parsed.publicPemPath || typeof parsed.publicPemPath !== 'string') {
  console.error('Could not resolve publicPemPath from keystore JSON.');
  process.exit(1);
}

mkdirSync(TRUST_DIR, { recursive: true });
const trustPath = resolve(TRUST_DIR, 'keys.json');

const trust = { keys: [{ keyId, publicPemPath: parsed.publicPemPath }] };
writeFileSync(trustPath, JSON.stringify(trust, null, 2) + '\n', 'utf8');

console.log(`[trust:init] wrote ${trustPath}`);
