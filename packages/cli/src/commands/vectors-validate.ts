// packages/cli/src/commands/vectors-validate.ts
// Validate proof-bundle vectors against MVS JSON Schemas.
// - English comments
// - No `any`
// - NodeNext ESM compatible
import path from 'node:path';
import * as fs from 'node:fs';
import process from 'node:process';
import { createAjv, loadSchemaJson } from '@zkpip/core';
import type { Argv, CommandBuilder, ArgumentsCamelCase, CommandModule } from 'yargs';

type VectorValidateArgs = Readonly<{
  'vectors-root'?: string;
  'schemas-root'?: string;
  json: boolean;
  'exit-codes': boolean;
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

export const builder: CommandBuilder<object, VectorValidateArgs> = (
  y: Argv<object>,
): Argv<VectorValidateArgs> => {
  return y
    .option('vectors-root', {
      type: 'string',
      description: 'Root directory of vectors (defaults to ./vectors if not provided)',
    })
    .option('schemas-root', {
      type: 'string',
      description: 'Root directory of schemas (override; exported to ZKPIP_SCHEMAS_ROOT)',
    })
    .option('json', {
      type: 'boolean',
      default: false,
      description: 'Emit machine-readable JSON',
    })
    .option('exit-codes', {
      type: 'boolean',
      default: false,
      description: 'Return 0 if all valid, 1 if any invalid, 2 on runtime error',
    }) as Argv<VectorValidateArgs>;
};

function resolveAbs(p?: string): string | undefined {
  if (!p) return undefined;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// Recursively collect JSON files; by default we keep it generic,
// but we filter to filenames containing "proof-bundle" to match the schema below.
function walkJson(root: string): readonly string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    const ents = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(p);
      } else if (ent.isFile() && p.endsWith('.json')) {
        out.push(p);
      }
    }
  }
  // narrow to proof-bundle vectors; adjust if you add more schemas
  return out.filter((p) => path.basename(p).includes('proof-bundle')).sort();
}

function safeParseJson(raw: string): JSONValue {
  // If parse fails, throw — caller catches and classifies as runtime error (exit 2)
  return JSON.parse(raw) as JSONValue;
}

export async function handler(argv: ArgumentsCamelCase<VectorValidateArgs>): Promise<void> {
  try {
    // Resolve roots
    const vectorsRoot = resolveAbs(argv['vectors-root']) ?? path.resolve(process.cwd(), 'vectors');
    const schemasRoot = resolveAbs(argv['schemas-root']);
    if (schemasRoot) {
      // Surface to core loaders that rely on this environment hint
      process.env.ZKPIP_SCHEMAS_ROOT = schemasRoot;
    }

    // Prepare AJV and add the proof-bundle schema (extend as needed)
    const ajv = createAjv();
    const proofBundleSchema = loadSchemaJson('mvs/proof-bundle.schema.json');
    ajv.addSchema(proofBundleSchema, 'mvs/proof-bundle');

    const files = walkJson(vectorsRoot);
    if (files.length === 0) {
      const msg = `No JSON vectors found under: ${vectorsRoot}`;
      if (argv.json) {
        process.stdout.write(JSON.stringify({ ok: false, error: msg, results: [] }) + '\n');
      } else {
        process.stdout.write(`ℹ ${msg}\n`);
      }
      if (argv['exit-codes']) process.exitCode = 1; // treat "no vectors" as invalid set
      return;
    }

    const validate = ajv.getSchema('mvs/proof-bundle');
    if (!validate) {
      throw new Error(`Schema 'mvs/proof-bundle' is not registered`);
    }

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

    if (argv.json) {
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

    if (argv['exit-codes']) {
      process.exitCode = allOk ? 0 : 1;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if ((argv as { json?: boolean }).json) {
      process.stderr.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    } else {
      process.stderr.write(`✖ Vector validation failed: ${msg}\n`);
    }
    if ((argv as { 'exit-codes'?: boolean })['exit-codes']) {
      process.exitCode = 2;
    }
  }
}

export const vectorsValidateCmd: CommandModule<object, VectorValidateArgs> = {
  command,
  describe,
  builder,
  handler,
};
