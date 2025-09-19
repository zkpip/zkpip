// packages/cli/src/commands/vectors-validate.ts
// Validate proof-bundle vectors against MVS JSON Schemas (yargs-free).
// - English comments
// - No `any`
// - NodeNext ESM compatible

import path from 'node:path';
import * as fs from 'node:fs';
import process from 'node:process';
import { createAjv, loadSchemaJson } from '@zkpip/core';

type VectorValidateFlags = Readonly<{
  vectorsRoot?: string;
  schemasRoot?: string;
  json: boolean;
  exitCodes: boolean;
}>;

type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONArray = ReadonlyArray<JSONValue>;
type JSONObject = { readonly [k: string]: JSONValue };

type ValidationRow = Readonly<{
  file: string;
  valid: boolean;
  errors: readonly unknown[];
}>;

export const command = 'vectors-validate';
export const describe = 'Validate vectors against MVS schemas';

/** Minimal flag parser compatible with: --vectors-root, --schemas-root, --json, --exit-codes (and their =value forms). */
function parseFlags(argv: readonly string[]): VectorValidateFlags {
  let vectorsRoot: string | undefined;
  let schemasRoot: string | undefined;
  let json = false;
  let exitCodes = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';

    if (a === '--json' || a === '-j' || a.startsWith('--json=')) json = true;

    if (a === '--exit-codes' || a === '--use-exit-codes' || a.startsWith('--exit-codes=')) {
      exitCodes = true;
    }

    if (a === '--vectors-root') {
      const v = argv[i + 1];
      if (typeof v === 'string') {
        vectorsRoot = v;
        i++;
      }
      continue;
    }
    if (a.startsWith('--vectors-root=')) {
      vectorsRoot = a.slice('--vectors-root='.length);
      continue;
    }

    if (a === '--schemas-root') {
      const v = argv[i + 1];
      if (typeof v === 'string') {
        schemasRoot = v;
        i++;
      }
      continue;
    }
    if (a.startsWith('--schemas-root=')) {
      schemasRoot = a.slice('--schemas-root='.length);
      continue;
    }
  }

  return {
    ...(vectorsRoot !== undefined ? { vectorsRoot } : {}),
    ...(schemasRoot !== undefined ? { schemasRoot } : {}),
    json,
    exitCodes,
  } as const satisfies VectorValidateFlags;  
}

function resolveAbs(p?: string): string | undefined {
  if (!p) return undefined;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

/** Recursively collect JSON files; we filter to filenames containing "proof-bundle" to match the schema below. */
function walkJson(root: string): readonly string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    const ents = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile() && p.endsWith('.json')) out.push(p);
    }
  }
  return out.filter((p) => path.basename(p).includes('proof-bundle')).sort();
}

function safeParseJson(raw: string): JSONValue {
  return JSON.parse(raw) as JSONValue;
}

/** Core implementation: performs validation and prints result according to flags. */
export async function runVectorsValidateCli(argv: readonly string[]): Promise<void> {
  const flags = parseFlags(argv);

  try {
    const vectorsRoot =
      resolveAbs(flags.vectorsRoot) ?? path.resolve(process.cwd(), 'vectors');
    const schemasRoot = resolveAbs(flags.schemasRoot);
    if (schemasRoot) process.env.ZKPIP_SCHEMAS_ROOT = schemasRoot;

    // AJV + schema registration (legacy proof-bundle)
    const ajv = createAjv();
    const proofBundleSchema = loadSchemaJson('mvs/proof-bundle.schema.json');
    ajv.addSchema(proofBundleSchema, 'mvs/proof-bundle');

    const files = walkJson(vectorsRoot);
    if (files.length === 0) {
      const msg = `No JSON vectors found under: ${vectorsRoot}`;
      if (flags.json) {
        process.stdout.write(JSON.stringify({ ok: false, error: msg, results: [] }) + '\n');
      } else {
        process.stdout.write(`ℹ ${msg}\n`);
      }
      if (flags.exitCodes) process.exitCode = 1; // treat "no vectors" as invalid set
      return;
    }

    const validate = ajv.getSchema('mvs/proof-bundle');
    if (!validate) throw new Error(`Schema 'mvs/proof-bundle' is not registered`);

    const results: ValidationRow[] = [];
    for (const abs of files) {
      const rel = path.relative(vectorsRoot, abs);
      const raw = fs.readFileSync(abs, 'utf8');
      const data = safeParseJson(raw);
      const isValid = Boolean(validate(data));
      const errs: readonly unknown[] = isValid ? [] : (validate.errors ?? []);
      results.push({ file: rel, valid: isValid, errors: errs });
    }

    const allOk = results.every((r) => r.valid);

    if (flags.json) {
      const payload = {
        ok: allOk,
        vectorsRoot,
        schema: 'mvs/proof-bundle',
        results,
      } as const;
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      process.stdout.write(`Schema: mvs/proof-bundle\nRoot:   ${vectorsRoot}\n\n`);
      for (const r of results) {
        process.stdout.write(`${r.valid ? '✅' : '❌'} ${r.file}\n`);
        if (!r.valid && r.errors.length > 0) {
          process.stdout.write(JSON.stringify(r.errors, null, 2) + '\n');
        }
      }
      process.stdout.write(
        `\nSummary: ${results.filter((r) => r.valid).length}/${results.length} valid\n`,
      );
    }

    if (flags.exitCodes) process.exitCode = allOk ? 0 : 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (flags.json) {
      process.stderr.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    } else {
      process.stderr.write(`✖ Vector validation failed: ${msg}\n`);
    }
    if (flags.exitCodes) process.exitCode = 2;
  }
}

/** Back-compat export for smoke test: yargs-free command module shape with only `handler`. */
export const handler = async (argv: {
  'vectors-root'?: string;
  'schemas-root'?: string;
  json?: boolean;
  'exit-codes'?: boolean;
}): Promise<void> => {
  const args: string[] = [];

  if (argv['vectors-root']) args.push(`--vectors-root=${argv['vectors-root']}`);
  if (argv['schemas-root']) args.push(`--schemas-root=${argv['schemas-root']}`);
  if (argv.json) args.push('--json');
  if (argv['exit-codes']) args.push('--exit-codes');

  await runVectorsValidateCli(args);
};

/** Export an object with the same keys the smoke test looks for, but without yargs types. */
export const vectorsValidateCmd = {
  command,
  describe,
  // builder intentionally omitted (no yargs)
  handler,
};

export default vectorsValidateCmd;
