#!/usr/bin/env node
/* eslint-disable no-console */

// Minimal, dependency-light CLI for BatchSeal
// Usage:
//   zkpip batchseal --adapter <groth16|plonk|stark> <file ...>
// Example:
//   zkpip batchseal --adapter groth16 samples/*.json

import { readFileSync, statSync } from 'node:fs';
import { glob } from 'glob';
import {
  type Adapter,
  type AdapterKind,
  type ProofBundle,
  type AdapterVerifyResult,
} from '@zkpip/core';
import { sealBatch } from '@zkpip/batchseal';
import { groth16Adapter } from '@zkpip/adapters-groth16';
import { plonkAdapter } from '@zkpip/adapters-plonk';
import { starkAdapter } from '@zkpip/adapters-stark';

type AdapterName = 'groth16' | 'plonk' | 'stark';

const adapters: Record<AdapterName, Adapter<AdapterName>> = {
  groth16: groth16Adapter,
  plonk: plonkAdapter,
  stark: starkAdapter,
} as const;

function printHelp(): void {
  console.log(
    [
      'zkpip - Zero-Knowledge Proof Interop CLI',
      '',
      'Usage:',
      '  zkpip batchseal --adapter <groth16|plonk|stark> <file ...>',
      '',
      'Options:',
      '  -a, --adapter   Required. One of: groth16, plonk, stark',
      '  -h, --help      Show this help',
      '',
      'Notes:',
      '  - File globs are supported cross-platform (e.g., samples/*.json).',
    ].join('\n'),
  );
}

// Ensure we always emit machine-readable JSON on early failures
function fail(errAdapter: AdapterKind | 'unknown', msg: string): void {
  console.error(msg); // human-readable on stderr
  console.log(
    JSON.stringify(
      { adapter: errAdapter, total: 0, passed: 0, failed: 0, error: msg },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

// Simple zero-dep argument parser
function parseArgs(argv: string[]): {
  cmd?: string;
  adapter?: AdapterName;
  patterns: string[];
  help?: boolean;
} {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) return { patterns: [], help: true };

  const result: { cmd?: string; adapter?: AdapterName; patterns: string[] } = { patterns: [] };
  let i = 0;
  while (i < args.length) {
    const token = args[i];
    if (!result.cmd) {
      result.cmd = token;
      i++;
      continue;
    }
    if (token === '-a' || token === '--adapter') {
      const val = args[i + 1] as AdapterName | undefined;
      if (!val) throw new Error('Missing value for --adapter');
      result.adapter = val;
      i += 2;
      continue;
    }
    result.patterns.push(token);
    i++;
  }
  return result;
}

// Best-effort detection of declared adapter kind inside payload
function detectDeclaredKind(payload: unknown): AdapterKind | undefined {
  const v =
    (payload as any)?.adapter ??
    (payload as any)?.meta?.adapter ??
    (payload as any)?.adapterKind ??
    (payload as any)?.proof?.adapter;

  if (v === 'groth16' || v === 'plonk' || v === 'stark') return v;
  return undefined;
}

// Normalize Windows backslashes for glob patterns
function normalizePattern(p: string): string {
  return p.replace(/\\/g, '/');
}

async function main(): Promise<void> {
  let errAdapter: AdapterKind | 'unknown' = 'unknown';

  try {
    const parsed = parseArgs(process.argv);
    const { cmd, patterns, help } = parsed;

    if (help || !cmd) {
      printHelp();
      process.exitCode = 0;
      return;
    }
    if (cmd !== 'batchseal') {
      fail(errAdapter, `Unknown command: ${cmd}`);
      printHelp();
      return;
    }

    if (!parsed.adapter) {
      printHelp();
      fail(errAdapter, 'Missing required option: --adapter <groth16|plonk|stark>');
      return;
    }
    const adapterName: AdapterName = parsed.adapter;
    const adapter = adapters[adapterName];
    errAdapter = adapter.kind;

    if (patterns.length === 0) {
      printHelp();
      fail(errAdapter, 'No input files provided.');
      return;
    }

    // Expand patterns: support both direct file paths and globs; normalize slashes for Windows
    const patternsNorm = patterns.map(normalizePattern);

    // If a pattern points to an existing file, add it directly; otherwise let glob resolve it
    const fileCandidates = await Promise.all(
      patternsNorm.map(async (p) => {
        try {
          const st = statSync(p);
          return st.isFile() ? [p] : await glob(p);
        } catch {
          // Not a direct file → treat as glob
          return await glob(p);
        }
      }),
    );

    const files = Array.from(new Set(fileCandidates.flat()));
    if (files.length === 0) {
      fail(errAdapter, 'No files matched the given patterns.');
      return;
    }

    // Build bundles and pre-filter mismatches
    const sanitized: ProofBundle[] = [];
    const preResults: AdapterVerifyResult[] = [];

    for (const f of files) {
      const payload = JSON.parse(readFileSync(f, 'utf8')) as unknown;
      const declared = detectDeclaredKind(payload);

      if (declared && declared !== adapter.kind) {
        preResults.push({
          ok: false,
          adapter: adapter.kind,
          bundleId: f,
          code: 'WRONG_ADAPTER',
          message: `Declared adapter is ${declared}, but CLI adapter is ${adapter.kind}`,
        });
        continue;
      }

      const bundle: ProofBundle = {
        id: f,
        adapter: (declared ?? adapter.kind) as AdapterKind,
        payload,
      };
      sanitized.push(bundle);
    }

    // Run BatchSeal only on sanitized inputs
    const batch = await sealBatch(adapter, sanitized);

    // Merge preResults with actual results
    const total = sanitized.length + preResults.length;
    const passed = batch.passed;
    const failed = batch.failed + preResults.length;

    const merged = {
      adapter: adapter.kind,
      total,
      passed,
      failed,
      results: [...preResults, ...batch.results],
    };

    console.log(JSON.stringify(merged, null, 2));
    process.exitCode = failed === 0 ? 0 : 1; // ensure exit code matches result
    return;
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    fail(errAdapter, msg);
    return;
  }
}

void main();
