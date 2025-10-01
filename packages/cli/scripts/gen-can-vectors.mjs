#!/usr/bin/env node
/**
 * Generate manifest conformance vectors under <REPO_ROOT>/can/manifest/{valid,invalid}
 * CWD-independent: resolves paths from script location.
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from '../dist/utils/fs-compat.js';
import { ExitCode } from './utils/exit-codes.mjs';

function b64uToBuf(s) {
  // convert base64url -> base64
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + ('==='.slice((s.length + 3) % 4));
  return Buffer.from(b64, 'base64');
}

function bufToB64u(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function requireArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) {
    const note = `Missing required arg: ${name}`;
    console.error(note);
    return ExitCode.INVALID_ARGS;
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
const sigBuf = b64uToBuf(okObj.signature.sig);
// flip the last bit of the last byte to guarantee a change
sigBuf[sigBuf.length - 1] ^= 0x01;
const mutated = { ...okObj, signature: { ...okObj.signature, sig: bufToB64u(sigBuf) } };
writeFileSync(resolve(canInvalidDir, 'signature_invalid.json'), JSON.stringify(mutated, null, 2) + '\n', 'utf8');

// 3) invalid: hash_mismatch
const badHash = JSON.parse(JSON.stringify(okObj));
badHash.meta = { ...(badHash.meta ?? {}), tampered: true };
writeFileSync(resolve(canInvalidDir, 'hash_mismatch.json'), JSON.stringify(badHash, null, 2) + '\n', 'utf8');

// 4) invalid: missing_signature
const missingSig = JSON.parse(JSON.stringify(okObj));
delete missingSig.signature;
writeFileSync(resolve(canInvalidDir, 'missing_signature.json'), JSON.stringify(missingSig, null, 2) + '\n', 'utf8');

console.log('[can:gen] generated vectors at can/manifest/{valid,invalid}');
