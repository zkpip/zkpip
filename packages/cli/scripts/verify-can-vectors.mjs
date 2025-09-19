#!/usr/bin/env node
/**
 * Verify conformance vectors; CWD-independent.
 */
import { readdirSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

function requireArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) {
    console.error(`Missing required arg: ${name}`);
    process.exit(2);
  }
  return process.argv[i + 1];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PKG_ROOT = resolve(__dirname, '..');      // packages/cli
const REPO_ROOT = resolve(PKG_ROOT, '..', '..'); // repo root
const norm = (p) => (isAbsolute(p) ? p : resolve(REPO_ROOT, p));

const pubPath  = norm(requireArg('--pub'));
const cliEntry = resolve(PKG_ROOT, 'dist/index.js');

function verifyOne(p) {
  try {
    execFileSync(
      process.execPath,
      [cliEntry, 'manifest', 'verify', '--in', p, '--pub', pubPath, '--json', '--use-exit-codes'],
      { encoding: 'utf8' }
    );
    return true;
  } catch {
    return false;
  }
}

const validDir  = resolve(REPO_ROOT, 'can/manifest/valid');
const invalidDir = resolve(REPO_ROOT, 'can/manifest/invalid');

let failures = [];

for (const f of readdirSync(validDir)) {
  if (!f.endsWith('.json')) continue;
  const p = join(validDir, f);
  if (!verifyOne(p)) failures.push(`expected OK: ${p}`);
}
for (const f of readdirSync(invalidDir)) {
  if (!f.endsWith('.json')) continue;
  const p = join(invalidDir, f);
  if (verifyOne(p)) failures.push(`expected FAIL: ${p}`);
}

if (failures.length) {
  console.error('[can:verify] failures:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('[can:verify] all vectors behaved as expected');
