import fs from 'node:fs';
import path from 'node:path';
import type { Argv, ArgumentsCamelCase, CommandModule } from 'yargs';
import { pickAdapter, getAdapterById, getAllAdapters } from '../registry/adapterRegistry.js';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '@zkpip/core';

type VerifyExit = 0 | 1 | 2 | 3 | 4;

/** Shared fields across meta and input */
type VerificationFields = {
  proofSystem?: string;
  framework?: string;
  recordType?: string;
  proof?: string;
  publicInputs?: string;
};

type VerificationMeta = VerificationFields;

/** Input extends the same, plus optional meta */
type VerificationInput = VerificationFields & {
  meta?: VerificationMeta;
};

type VerifyArgs = {
  bundle?: string;
  verification?: string;
  adapter?: string;
  json: boolean;
  'exit-codes': boolean;
  exitCodes: boolean; // camel alias (yargs)
  debug: boolean;
  'list-adapters': boolean;
  listAdapters: boolean; // camel alias
};

// --- Emit payloads (strict, stage is mandatory on error)
type EmitOk = {
  ok: true;
  adapter?: string;
  message?: string;
  debug?: unknown;
};

type EmitErr = {
  ok: false;
  stage: 'schema' | 'adapter' | 'verify' | 'io';
  adapter?: string;
  error?: string;
  message?: string;
  schemaRef?: string;
  errors?: unknown[];
  debug?: unknown;
};

type EmitPayload = EmitOk | EmitErr;

// --- Adapter attempt for --debug
type Attempt = { id: string; canHandle: boolean };

function normalizeSchemaRef(s?: string): string | undefined {
  if (!s) return;
  const t = s.trim();
  // már az új névtér?
  if (t.startsWith("urn:zkpip:mvs:schemas:")) return t;

  switch (t) {
    case CANONICAL_IDS.proofBundle:  return "urn:zkpip:mvs:schemas:proofBundle.schema.json";
    case CANONICAL_IDS.verification: return "urn:zkpip:mvs:schemas:verification.schema.json";
    case CANONICAL_IDS.cir:          return "urn:zkpip:mvs:schemas:cir.schema.json";
    case CANONICAL_IDS.issue:        return "urn:zkpip:mvs:schemas:issue.schema.json";
    case CANONICAL_IDS.ecosystem:    return "urn:zkpip:mvs:schemas:ecosystem.schema.json";
    case CANONICAL_IDS.core:         return "urn:zkpip:mvs:schemas:core.schema.json";
    default: return undefined;
  }
}

const builder = (y: Argv<object>) =>
  y
    .option('bundle', {
      type: 'string',
      describe: 'Path to a proof-bundle JSON file',
    })
    .option('verification', {
      type: 'string',
      describe: 'Path to a verification JSON file (alternative input)',
    })
    .option('adapter', {
      type: 'string',
      describe: 'Force a specific adapter id (e.g. snarkjs-groth16)',
    })
    .option('list-adapters', {
      type: 'boolean',
      default: false,
      describe: 'List available adapters and exit',
    })
    .option('json', {
      type: 'boolean',
      default: false,
      describe: 'Emit machine-readable JSON output',
    })
    .option('exit-codes', {
      type: 'boolean',
      default: false,
      describe:
        'Non-zero exit codes on failure (1=verify failed, 2=adapter not found/unsupported, 3=schema invalid, 4=I/O error)',
    })
    .option('debug', {
      type: 'boolean',
      default: false,
      describe: 'Verbose error output on failures',
    })
    .parserConfiguration({ 'camel-case-expansion': true })
    .check((argv) => {
      if (argv.listAdapters) return true;
      if (!argv.bundle && !argv.verification) {
        throw new Error('Provide --bundle or --verification');
      }
      return true;
    })
    .conflicts('bundle', 'verification') as unknown as Argv<VerifyArgs>;

function errnoCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const anyObj = err as Record<string, unknown>;
  return typeof anyObj.code === 'string' ? anyObj.code : undefined;
}

export const verifyCmd: CommandModule<object, VerifyArgs> = {
  command: 'verify',
  describe: 'Verify a proof bundle or a verification JSON input',
  builder,
  handler: async (argv: ArgumentsCamelCase<VerifyArgs>) => {
    let exitCode: VerifyExit = 0;
    let inputPath = '';
    let attemptsForDebug: Attempt[] | undefined;

    // Normalize flags (avoid repeating alias logic)
    const wantExit = !!(argv['exit-codes'] || argv.exitCodes);
    const wantJson = !!argv.json;
    const wantDebug = !!argv.debug;
    const wantList = !!(argv.listAdapters || argv['list-adapters']);

    const emit = (obj: EmitPayload) => {
      if (obj.ok) {
        if (wantJson) {
          console.log(JSON.stringify(obj, null, 2));
        } else {
          console.log(obj.message ?? 'OK');
          if (wantDebug && obj.debug) console.error(obj.debug);
        }
      } else {
        if (wantJson) {
          console.error(JSON.stringify(obj, null, 2));
        } else {
          const msg = obj.message ?? obj.error ?? 'ERROR';
          console.error('ERROR:', msg);
          if (wantDebug && obj.debug) console.error(obj.debug);
        }
      }
    };

    // EARLY EXIT: --list-adapters
    if (wantList) {
      const rows = getAllAdapters().map((a) => ({
        id: a.id,
        proofSystem: a.proofSystem,
        framework: a.framework,
      }));

      if (wantJson) {
        console.log(JSON.stringify({ ok: true, adapters: rows }, null, 2));
      } else {
        console.table(rows);
      }
      if (wantExit) process.exit(0);
      return;
    }

    try {
      // Read and parse input
      inputPath = path.resolve(String(argv.bundle ?? argv.verification));
      const raw = fs.readFileSync(inputPath, 'utf8');
      const input = JSON.parse(raw) as VerificationInput;

      // 1) Schema validation via canonical IDs
      const ajv = createAjv();
      addCoreSchemas(ajv);

      function hasPath(o: unknown, path: string): boolean {
        if (!o || typeof o !== "object") return false;
        const parts = path.split(".");
        let cur: unknown = o;
        for (const p of parts) {
          if (!cur || typeof cur !== "object") return false;
          cur = (cur as Record<string, unknown>)[p];
        }
        return cur !== undefined;
      }

      function isProofBundleLike(x: unknown): boolean {
        if (!x || typeof x !== "object") return false;
        const o = x as Record<string, unknown>;

        const s = typeof o.$schema === "string" ? o.$schema.toLowerCase() : "";
        if (s.includes("proofbundle") || s.includes("proof-bundle")) return true;

        const rt = typeof o.recordType === "string" ? o.recordType.toLowerCase() : "";
        if (rt.includes("bundle")) return true;

        if ("bundleId" in o || "artifacts" in o || "verifier" in o || "result" in o) return true;
        if ("proof" in o || "publicInputs" in o || "publicSignals" in o) return true;

        return false;
      }

      const declared = typeof (input as any)?.$schema === "string" ? String((input as any).$schema) : undefined;
      const normalized = normalizeSchemaRef(declared);
      const looksLikeBundle = isProofBundleLike(input);

      const schemaId =
        normalized ??
        (looksLikeBundle
          ? "urn:zkpip:mvs:schemas:proofBundle.schema.json"
          : "urn:zkpip:mvs:schemas:verification.schema.json");

      if (wantDebug) {
        console.error("[verify] chosen schema:", schemaId, "(declared:", declared, "bundleLike:", looksLikeBundle, ")");
      }      

      const validate = ajv.getSchema(schemaId) ?? ajv.compile({ $ref: schemaId });
      const valid = !!validate(input);

      if (!valid) {
        exitCode = 3;
        emit({
          ok: false,
          stage: 'schema',
          schemaRef: schemaId,
          errors: validate.errors ?? [],
          message: 'Input failed MVS schema validation.',
          debug: argv.debug ? { file: inputPath, chosenSchema: schemaId, looksLikeBundle } : undefined,
        });
        if (argv['exit-codes'] || argv.exitCodes) process.exit(exitCode);
        return;
      }

      // 2) Adapter selection (forced or heuristic)
      let adapter = undefined as ReturnType<typeof getAdapterById> | undefined;

      if (argv.adapter) {
        adapter = getAdapterById(String(argv.adapter));
        if (!adapter) {
          exitCode = 2;
          emit({
            ok: false,
            stage: 'adapter',
            message: `Adapter not found: ${argv.adapter}`,
            debug: wantDebug
              ? { available: getAllAdapters().map((a) => a.id) }
              : undefined,
          });
          if (wantExit) process.exit(exitCode);
          return;
        }
      } else {
        attemptsForDebug = getAllAdapters().map((a) => ({
          id: a.id,
          canHandle: a.canHandle(input),
        }));
        adapter = pickAdapter(input);
      }

      if (!adapter) {
        exitCode = 2;
        emit({
          ok: false,
          stage: 'adapter',
          message: 'No suitable adapter found for this input.',
          debug: wantDebug
            ? {
                sniff: {
                  proofSystem: (input as VerificationInput)?.proofSystem ?? (input as VerificationInput)?.meta?.proofSystem,
                  framework: (input as VerificationInput)?.framework ?? (input as VerificationInput)?.meta?.framework,
                },
                attempts: attemptsForDebug,
              }
            : undefined,
        });
        if (wantExit) process.exit(exitCode);
        return;
      }

      // 3) Run verification
      const res = await adapter.verify(input);

      if (res.ok) {
        emit({
          ok: true,
          adapter: res.adapter,
          message: `Verified by adapter: ${res.adapter}`,
          debug: wantDebug ? { attempts: attemptsForDebug } : undefined,
        });
        if (wantExit) process.exit(0);
      } else {
        exitCode = 1;
        emit({
          ok: false,
          stage: 'verify',
          adapter: res.adapter,
          error: res.error ?? 'verification_failed',
          message: `Verification failed in adapter: ${res.adapter} (${res.error ?? 'unknown'})`,
          debug: wantDebug ? { attempts: attemptsForDebug } : undefined,
        });
        if (wantExit) process.exit(exitCode);
      }
    } catch (err) {
      exitCode = 4;

      const code = errnoCode(err);
      const friendlyCodes = new Set(['ENOENT', 'EISDIR', 'EACCES', 'EPERM']);
      const friendly = code ? friendlyCodes.has(code) : false;

      emit({
        ok: false,
        stage: 'io',
        error: code ?? String((err as Error)?.message ?? err),
        message: friendly
          ? `Input file not readable: ${inputPath || '(unknown path)'} (${code})`
          : 'Failed to read or process the input file.',
        debug: wantDebug
          ? friendly
            ? { file: inputPath || '(unknown path)' }
            : String((err as Error)?.stack ?? err)
          : undefined,
      });

      if (wantExit) process.exit(exitCode);
    }
  },
};
