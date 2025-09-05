// packages/cli/src/commands/vectors-validate.ts
import type { CommandModule } from 'yargs';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { createAjv, loadSchemaJson } from '@zkpip/core';

type Options = {
  'vectors-root'?: string;
  'schemas-root'?: string;
  json?: boolean;
  'exit-codes'?: boolean;
};

function resolveAbs(p?: string): string | undefined {
  if (!p) return undefined;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function walkJson(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile() && p.endsWith('.json')) out.push(p);
    }
  }
  return out;
}

export function buildVectorsValidateCommand(): CommandModule<object, Options> {
  return {
    command: 'vectors validate',
    describe: 'Validate vectors against MVS schemas',
    builder: (y) =>
      y
        .option('vectors-root', {
          type: 'string',
          describe: 'Root directory of vectors',
        })
        .option('schemas-root', {
          type: 'string',
          describe: 'Root directory of schemas (override)',
        })
        .option('json', {
          type: 'boolean',
          default: false,
          describe: 'Machine-readable JSON output',
        })
        .option('exit-codes', {
          type: 'boolean',
          default: false,
          describe: 'Set exit codes based on result',
        }),
    handler: async (argv) => {
      try {
        const vectorsRoot =
          resolveAbs(argv['vectors-root']) ?? path.resolve(process.cwd(), 'vectors');
        const schemasRoot = resolveAbs(argv['schemas-root']);

        if (schemasRoot) {
          process.env.ZKPIP_SCHEMAS_ROOT = schemasRoot;
        }

        const ajv = createAjv();
        // Példa: proof-set séma hozzáadása (bővítsd igény szerint)
        const proofSetSchema = loadSchemaJson('mvs/proof-set.schema.json');
        ajv.addSchema(proofSetSchema, 'mvs/proof-set');

        const files = walkJson(vectorsRoot);
        const results: Array<{ file: string; valid: boolean; errors: unknown[] }> = [];

        const validate = ajv.getSchema('mvs/proof-set');
        if (!validate) throw new Error("Schema 'mvs/proof-set' not found.");

        for (const f of files) {
          const raw = fs.readFileSync(f, 'utf8');
          const data = JSON.parse(raw);
          const ok = Boolean(validate(data));
          results.push({
            file: path.relative(vectorsRoot, f),
            valid: ok,
            errors: ok ? [] : (validate.errors ?? []),
          });
        }

        const allOk = results.every((r) => r.valid);

        if (argv.json) {
          console.log(JSON.stringify({ ok: allOk, results }, null, 2));
        } else {
          for (const r of results) {
            console.log(`${r.valid ? '✅' : '❌'} ${r.file}`);
            if (!r.valid) console.log(JSON.stringify(r.errors, null, 2));
          }
        }

        if (argv['exit-codes']) {
          process.exit(allOk ? 0 : 1);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (argv.json) {
          console.error(JSON.stringify({ ok: false, error: msg }));
        } else {
          console.error(`✖ Vector validation failed: ${msg}`);
        }
        process.exit(2);
      }
    },
  };
}
