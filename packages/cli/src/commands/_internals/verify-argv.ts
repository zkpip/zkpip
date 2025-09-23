// packages/cli/src/commands/_internals/verify-argv.ts
import { resolve } from 'node:path';
import type { VerifyArgs } from '../types.js';

export function getDumpNormalizedArg(argv: Readonly<VerifyArgs> | unknown): string | undefined {
  if (argv && typeof argv === 'object' && 'dumpNormalized' in argv) {
    const v = (argv as { dumpNormalized?: unknown }).dumpNormalized;
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

export function prettyVerificationPath(argv: Readonly<VerifyArgs> | unknown): string {
  if (argv && typeof argv === 'object' && 'verification' in argv) {
    const v = (argv as { verification?: unknown }).verification;
    if (typeof v === 'string') return resolve(process.cwd(), v);
  }
  return '<inline-json>';
}
