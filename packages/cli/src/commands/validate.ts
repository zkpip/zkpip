// packages/cli/src/commands/validate.ts
// CLI entry for JSON Schema validation.
// Uses schemaUtils bootstrap (createAjv + addCoreSchemas) and the filename-based picker.
// English comments, no `any`.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { createAjv, addCoreSchemas } from '@zkpip/core';
import { pickSchemaId } from './pickSchemaId.js';

type ErrorObject = {
  readonly path?: string;
  readonly instancePath?: string;
  readonly message?: string;
  readonly keyword?: string;
};

type AjvErrorCarrier = Error & { errors?: ReadonlyArray<ErrorObject> | null };

/* ---------------------------------------------------------------------- */
/*                          schemasRoot                                    */
/* ---------------------------------------------------------------------- */

// Safe argv flag reader (supports --flag value and --flag=value forms)
// Guards against undefined elements (noUncheckedIndexedAccess-friendly)
function getArgValue(flags: ReadonlyArray<string>): string | undefined {
  const argv: ReadonlyArray<string> = process.argv;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';

    // --flag=value
    const eq = flags.find((f) => arg.startsWith(f + '='));
    if (eq) return arg.slice(eq.length + 1);

    // --flag value
    if (flags.includes(arg)) {
      const next = argv[i + 1];
      if (typeof next === 'string' && !next.startsWith('-')) return next;
    }
  }
  return undefined;
}

/**
 * Installed  @zkpip/core → <corePackageDir>/schemas
 * Monorepo dev → <repo>/packages/core/schemas
 */
function inferCoreSchemasRoot(): string | undefined {
  // 1) Resolve from installed package location
  try {
    const require = createRequire(import.meta.url);
    const corePkgJson = require.resolve('@zkpip/core/package.json');
    const coreDir = path.dirname(corePkgJson);
    const candidate = path.resolve(coreDir, 'schemas');
    if (existsSync(candidate)) return candidate;
  } catch {
    // fall through to monorepo guess
  }

  // 2) Monorepo: <this_file>/../../../core/schemas
  try {
    const here = fileURLToPath(new URL('.', import.meta.url)); // .../packages/cli/dist/commands/
    const candidate = path.resolve(here, '../../../core/schemas');
    if (existsSync(candidate)) return candidate;
  } catch {
    // ignore
  }

  return undefined;
}

function resolveSchemasRootFromEnvArgsOrInfer(): string | undefined {
  const fromArg =
    getArgValue(['--schemas-root', '--schemasRoot']) ?? process.env.ZKPIP_SCHEMAS_ROOT ?? undefined;

  const absFromArg = fromArg ? path.resolve(String(fromArg)) : undefined;
  return absFromArg ?? inferCoreSchemasRoot();
}

/* ---------------------------------------------------------------------- */
/*                             validation core                              */
/* ---------------------------------------------------------------------- */

/**
 * Validate a single JSON file against a schema picked from its filename.
 * Throws an Error on validation failure; resolves (void) on success.
 */
export async function validatePath(inputPath: string): Promise<void> {
  const abs = path.resolve(inputPath);
  const raw = readFileSync(abs, 'utf-8');

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${abs}\n${String(e)}`);
  }

  // Bootstrap AJV (2020-12) with all core schemas
  const ajv = createAjv();

  const schemasRoot = resolveSchemasRootFromEnvArgsOrInfer();

  // Build options object conditionally (exactOptionalPropertyTypes-friendly)
  const opts: { schemasRoot?: string } = {};
  if (typeof schemasRoot === 'string' && schemasRoot.length > 0) {
    opts.schemasRoot = schemasRoot;
  }
  (addCoreSchemas as unknown as (a: unknown, o?: { schemasRoot?: string }) => void)(
    ajv,
    Object.keys(opts).length > 0 ? opts : undefined
  );

  // Pick target schema based on filename heuristics
  const schemaId = pickSchemaId(abs, schemasRoot);

  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    const hint =
      `Schema not registered in AJV: ${schemaId}\n` +
      `Ensure the schema exists under /schemas and has proper "$id".\n` +
      (schemasRoot
        ? `Using schemasRoot: ${schemasRoot}`
        : `Hint: pass --schemas-root ./packages/core/schemas (or set ZKPIP_SCHEMAS_ROOT)`);
    throw new Error(hint);
  }

  const ok = validate(data);
  if (!ok) {
    // Build a readable error message; attach raw errors for tests if needed
    const msg = ajv.errorsText(validate.errors, { separator: '\n' });
    const err: AjvErrorCarrier = new Error(
      `Validation failed for ${abs}\nSchema: ${schemaId}\n${msg}`
    );
    err.errors = validate.errors ?? null;
    throw err;
  }
}

/**
 * Thin CLI wrapper: keeps current behavior (exit codes, console output).
 * Usage: node dist/cli/validate.js <path-to-json> [--schemas-root <dir>]
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const fileArg = process.argv[2];
    if (!fileArg || fileArg.startsWith('-')) {
      console.error('Usage: zkpip-validate <path-to-json> [--schemas-root <dir>]');
      process.exit(2);
    }
    try {
      await validatePath(fileArg);
      console.log('✅ Validation OK');
      process.exit(0);
    } catch (e) {
      console.error(String(e instanceof Error ? e.message : e));
      process.exit(1);
    }
  })();
}
