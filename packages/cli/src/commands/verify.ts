import fs from 'node:fs';
import path from 'node:path';
import { pickAdapter, getAdapterById } from '../registry/adapterRegistry.js';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '@zkpip/core';

type VerifyExit = 0 | 1 | 2 | 3 | 4;

// Shared fields across meta and input
type VerificationFields = {
  proofSystem?: string;
  framework?: string;
  recordType?: string;
  proof?: string;
  publicInputs?: string;
};

// Meta contains the same shape
type VerificationMeta = VerificationFields;

// Input extends the same, plus optional meta
type VerificationInput = VerificationFields & {
  meta?: VerificationMeta;
};

import type {
  Argv,
  ArgumentsCamelCase,
  CommandModule,
  CommandBuilder,
} from 'yargs';

type VerifyArgs = {
  bundle?: string;
  verification?: string;
  adapter?: string;
  json: boolean;
  'exit-codes': boolean;
  debug: boolean;
};

const builder: CommandBuilder<object, VerifyArgs> = (y: Argv<object>): Argv<VerifyArgs> =>
  (y
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
    .option('json', {
      type: 'boolean',
      default: false,
      describe: 'Emit machine-readable JSON output',
    })
    .option('exit-codes', {
      type: 'boolean',
      default: false,
      describe:
        'Non-zero exit codes on failure (2=no adapter, 3=schema invalid, 1=verify failed)',
    })
    .option('debug', {
      type: 'boolean',
      default: false,
      describe: 'Verbose error output on failures',
    })
    .conflicts('bundle', 'verification') as unknown) as Argv<VerifyArgs>;

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

export const verifyCmd: CommandModule<object, VerifyArgs> = {
  command: 'verify',
  describe: 'Verify a proof bundle or a verification JSON input',
  builder,
  handler: async (argv: ArgumentsCamelCase<VerifyArgs>) => {
    let exitCode: VerifyExit = 0;

    const emit = (obj: EmitPayload) => {
      if (argv.json) {
        (obj.ok ? console.log : console.error)(JSON.stringify(obj, null, 2));
        return;
      }

      if (obj.ok) {
        console.log(obj.message ?? 'OK');
      } else {
        // Itt már EmitErr-re szűkült, ezért van obj.error
        console.error('ERROR:', obj.message ?? obj.error ?? obj);
        if (argv.debug && obj.debug) console.error(obj.debug);
      }
    };

    try {
      // Read and parse input
      const p = path.resolve(String(argv.bundle ?? argv.verification));
      const raw = fs.readFileSync(p, 'utf8');
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
          debug: argv.debug ? { file: p } : undefined,
        });
        if (argv['exit-codes']) process.exit(exitCode);
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
          if (argv['exit-codes']) process.exit(exitCode);
          return;
        }
      } else {
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
              }
            : undefined,
        });
        if (argv['exit-codes']) process.exit(exitCode);
        return;
      }

      // 3) Run verification (stub adapters may return not_implemented)
      const res = await adapter.verify(input);

      if (res.ok) {
        emit({
          ok: true,
          adapter: res.adapter,
          message: `Verified by adapter: ${res.adapter}`,
        });
        if (argv['exit-codes']) process.exit(0);
      } else {
        exitCode = 1;
        emit({
          ok: false,
          adapter: res.adapter,
          error: res.error ?? 'verification_failed',
          message: `Verification failed in adapter: ${res.adapter} (${res.error ?? 'unknown'})`,
        });
        if (argv['exit-codes']) process.exit(exitCode);
      }
    } catch (err: unknown) {
      exitCode = 4;
      const e = err instanceof Error ? err : new Error(String(err));
      emit({
        ok: false,
        stage: 'io',
        error: e.message,
        message: 'Failed to read or process the input file.',
        debug: argv.debug ? (e.stack ?? String(err)) : undefined,
      });
      if (argv['exit-codes']) process.exit(exitCode);
    }
  },
};
