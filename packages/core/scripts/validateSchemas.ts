// packages/core/scripts/validateSchemas.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAjv } from '../src/validation/ajv.js';
import { addCoreSchemas } from '../src/validation/addCoreSchemas.js';
import { validatePath } from '../src/validate/vectors.js';

const rel = (p: string) => path.relative(process.cwd(), p).replace(/\\/g, '/');
const norm = (p: string) => p.replace(/\\/g, '/');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function listJsonFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile() && p.toLowerCase().endsWith('.json')) out.push(p);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

// Mark files as “invalid” if name or any path segment contains “invalid”
function isInvalidVector(file: string): boolean {
  const base = path.basename(file).toLowerCase();
  const segs = file.split(path.sep).map((s) => s.toLowerCase());
  return base.includes('invalid') || segs.includes('invalid');
}

// Expected-fail allowlist (relative to vectorsRoot)
function makeExpectedFailSet(vectorsRoot: string) {
  const expectedRel = new Set<string>([
    'mvs/cir/cir-valid-1.json',
    'mvs/cir/cir-valid-2.json',
    'mvs/cir/cir-valid-3.json',
    'mvs/proofBundle/proofBundle-valid-1.json',
    'mvs/proofBundle/proofBundle-valid-2.json',
    'mvs/proofBundle/proofBundle-valid-3.json',
  ]);
  const expectedAbs = new Set<string>();
  for (const r of expectedRel) {
    expectedAbs.add(norm(path.join(vectorsRoot, r)));
  }
  return { expectedAbs };
}

async function main() {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const vectorsRoot = path.resolve(__dirname, '..', 'schemas', 'tests', 'vectors');
  if (!fs.existsSync(vectorsRoot)) {
    console.log('ℹ️ No vectors directory found, skipping vector validation.');
    return;
  }

  const { expectedAbs } = makeExpectedFailSet(vectorsRoot);

  const allFiles = listJsonFiles(vectorsRoot);
  const invalidFiles = allFiles.filter(isInvalidVector);
  const validFiles = allFiles.filter((f) => !isInvalidVector(f));

  const validPassed: string[] = [];
  const validFailed: Array<{ file: string; error: unknown }> = [];
  const invalidFailedAsExpected: string[] = [];
  const invalidUnexpectedPassed: string[] = [];

  // VALID: should pass, except xfail (these should fail)
  for (const f of validFiles) {
    const isXFail = expectedAbs.has(norm(f));
    if (!isXFail) {
      try {
        await validatePath(f);
        console.log(`✓ valid   ${rel(f)}`);
        validPassed.push(f);
      } catch (err) {
        console.error(`✗ valid   ${rel(f)} → should pass, but failed`);
        console.error(String(err));
        validFailed.push({ file: f, error: err });
      }
    } else {
      // xfail: expected to fail
      try {
        await validatePath(f);
        console.error(`✗ xfail   ${rel(f)} → should fail (expected), but passed`);
        invalidUnexpectedPassed.push(f);
      } catch {
        console.log(`✓ xfail   ${rel(f)} (failed as expected)`);
        invalidFailedAsExpected.push(f);
      }
    }
  }

  // INVALID: should fail
  for (const f of invalidFiles) {
    try {
      await validatePath(f);
      console.error(`✗ invalid ${rel(f)} → should fail, but passed`);
      invalidUnexpectedPassed.push(f);
    } catch {
      console.log(`✓ invalid ${rel(f)} (failed as expected)`);
      invalidFailedAsExpected.push(f);
    }
  }

  const ok = validFailed.length === 0 && invalidUnexpectedPassed.length === 0;

  console.log(
    `Summary: ${validPassed.length} valid passed, ` +
      `${validFailed.length} valid failed, ` +
      `${invalidFailedAsExpected.length} invalid/xfail failed as expected, ` +
      `${invalidUnexpectedPassed.length} invalid/xfail passed (unexpected).`,
  );

  if (!ok) {
    if (validFailed.length) {
      console.error('Failed valid vectors:');
      for (const v of validFailed) console.error(`  - ${rel(v.file)}`);
    }
    if (invalidUnexpectedPassed.length) {
      console.error('Unexpectedly passed invalid/xfail vectors:');
      for (const f of invalidUnexpectedPassed) console.error(`  - ${rel(f)}`);
    }
    console.error('❌ MVS schema validation failed.');
    process.exitCode = 1;
    return;
  }

  console.log('✅ MVS schema validation complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
