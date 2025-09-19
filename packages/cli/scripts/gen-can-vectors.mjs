#!/usr/bin/env node
/**
 * Generate manifest conformance vectors under <REPO_ROOT>/can/manifest/{valid,invalid}
 * CWD-independent: resolves paths from script location.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
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
const __dirname = dirname(__filename);

// PKG root = packages/cli, REPO root = one level up from packages/
const PKG_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PKG_ROOT, '..', '..');

// Normalize helper: if absolute → keep; else resolve from REPO_ROOT
const norm = (p) => (isAbsolute(p) ? p : resolve(REPO_ROOT, p));

// Args (prefer repo-root-relative like "samples/...", "keys/...")
const inPath  = norm(requireArg('--in'));   // unsigned manifest
const keyPath = norm(requireArg('--key'));  // private key (PKCS#8)
const pubPath = norm(requireArg('--pub'));  // public key (SPKI)

// Output dirs under repo root
const canValidDir  = resolve(REPO_ROOT, 'can/manifest/valid');
const canInvalidDir = resolve(REPO_ROOT, 'can/manifest/invalid');
mkdirSync(canValidDir, { recursive: true });
mkdirSync(canInvalidDir, { recursive: true });

// Built CLI entry (under the same package)
const cliEntry = resolve(PKG_ROOT, 'dist/index.js');

function runCli(args) {
  return execFileSync(process.execPath, [cliEntry, ...args], { encoding: 'utf8' });
}

// 1) valid: ok.signed.json
const okOut = resolve(canValidDir, 'ok.signed.json');
runCli(['manifest', 'sign', '--in', inPath, '--out', okOut, '--priv', keyPath, '--key-id', 'zkpip:ci', '--json']);

// 2) invalid: signature_invalid
const okObj = JSON.parse(readFileSync(okOut, 'utf8'));
const badSig = { ...okObj, signature: { ...okObj.signature, sig: okObj.signature.sig.slice(0, -1) + 'A' } };
writeFileSync(resolve(canInvalidDir, 'signature_invalid.json'), JSON.stringify(badSig, null, 2) + '\n', 'utf8');

// 3) invalid: hash_mismatch
const badHash = JSON.parse(JSON.stringify(okObj));
badHash.meta = { ...(badHash.meta ?? {}), tampered: true };
writeFileSync(resolve(canInvalidDir, 'hash_mismatch.json'), JSON.stringify(badHash, null, 2) + '\n', 'utf8');

// 4) invalid: missing_signature
const missingSig = JSON.parse(JSON.stringify(okObj));
delete missingSig.signature;
writeFileSync(resolve(canInvalidDir, 'missing_signature.json'), JSON.stringify(missingSig, null, 2) + '\n', 'utf8');

console.log('[can:gen] generated vectors at can/manifest/{valid,invalid}');
