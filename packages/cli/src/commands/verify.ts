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
      describe: 'Non-zero exit codes on failure (2=no adapter, 3=schema invalid, 1=verify failed)',
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

type EmitOk = {
  ok: true;
  adapter?: string;
  message?: string;
};

type EmitErr = {
  ok: false;
  stage?: 'schema' | 'adapter' | 'io' | string;
  adapter?: string;
  error?: string;
  message?: string;
  schemaRef?: string;
  errors?: unknown[];
  debug?: unknown;
};

type EmitPayload = EmitOk | EmitErr;

type Attempt = { id: string; canHandle: boolean };

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

    const emit = (obj: EmitPayload) => {
      if (obj.ok) {
        if (argv.json) {
          console.log(JSON.stringify(obj, null, 2));
        } else {
          console.log(obj.message ?? 'OK');
          if (argv.debug && 'debug' in obj && obj.debug) console.error(obj.debug);
        }
      } else {
        if (argv.json) {
          console.error(JSON.stringify(obj, null, 2));
        } else {
          const msg = obj.message ?? obj.error ?? 'ERROR';
          console.error('ERROR:', msg);
          if (argv.debug && obj.debug) console.error(obj.debug);
        }
      }
    };

    // EARLY EXIT: --list-adapters
    if (argv.listAdapters || argv['list-adapters']) {
      const rows = getAllAdapters().map((a) => ({
        id: a.id,
        proofSystem: a.proofSystem,
        framework: a.framework,
      }));

      if (argv.json) {
        console.log(JSON.stringify({ ok: true, adapters: rows }, null, 2));
      } else {
        console.table(rows);
      }
      if (argv['exit-codes'] || argv.exitCodes) process.exit(0);
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

      const looksLikeBundle =
        typeof input?.recordType === 'string'
          ? input.recordType.toLowerCase().includes('bundle')
          : !!input?.proof || !!input?.publicInputs;

      const schemaId = looksLikeBundle ? CANONICAL_IDS.proofBundle : CANONICAL_IDS.verification;
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
          debug: argv.debug ? { file: inputPath } : undefined,
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
            debug: argv.debug
              ? { available: ['snarkjs-groth16', 'snarkjs-plonk', 'zokrates-groth16'] }
              : undefined,
          });
          if (argv['exit-codes'] || argv.exitCodes) process.exit(exitCode);
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
          debug: argv.debug
            ? {
                sniff: {
                  proofSystem: input?.proofSystem ?? input?.meta?.proofSystem,
                  framework: input?.framework ?? input?.meta?.framework,
                },
                attempts: attemptsForDebug,
              }
            : undefined,
        });
        if (argv['exit-codes'] || argv.exitCodes) process.exit(exitCode);
        return;
      }

      // 3) Run verification
      const res = await adapter.verify(input);

      if (res.ok) {
        emit({
          ok: true,
          adapter: res.adapter,
          message: `Verified by adapter: ${res.adapter}`,
        });
        if (argv['exit-codes'] || argv.exitCodes) process.exit(0);
      } else {
        exitCode = 1;
        emit({
          ok: false,
          adapter: res.adapter,
          error: res.error ?? 'verification_failed',
          message: `Verification failed in adapter: ${res.adapter} (${res.error ?? 'unknown'})`,
          debug: argv.debug ? { attempts: attemptsForDebug } : undefined,
        });
        if (argv['exit-codes'] || argv.exitCodes) process.exit(exitCode);
      }
    } catch (err) {
      exitCode = 4;

      const code = errnoCode(err);
      const friendly = code ? new Set(['ENOENT', 'EISDIR', 'EACCES', 'EPERM']).has(code) : false;

      emit({
        ok: false,
        stage: 'io',
        error: code ?? String((err as Error)?.message ?? err),
        message: friendly
          ? `Input file not readable: ${inputPath || '(unknown path)'} (${code})`
          : 'Failed to read or process the input file.',
        debug: argv.debug
          ? friendly
            ? { file: inputPath || '(unknown path)' }
            : String((err as Error)?.stack ?? err)
          : undefined,
      });

      if (argv['exit-codes'] || argv.exitCodes) process.exit(exitCode);
    }
  },
};
