// packages/cli/src/commands/verify.ts
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import type { Argv, ArgumentsCamelCase, CommandModule } from 'yargs';
import {
  availableAdapterIds,
  type AdapterId,
  getAdapterById,
  getAllAdapters,
} from '../registry/adapterRegistry.js';
import type { VerifyOutcome } from '../adapters/types.js';
import { createAjv, addCoreSchemas, CANONICAL_IDS } from '@zkpip/core';

// ---- types ---------------------------------------------------------------

type VerifyExit = 0 | 1 | 2 | 3 | 4;

type VerifyArgs = {
  bundle?: string;
  verification?: string;
  adapter?: string;
  json: boolean;
  // accept both spellings to be robust with scripts
  'exit-codes': boolean;
  exitCodes: boolean;            // camel alias
  'use-exit-codes': boolean;    // alternate flag spelling (supported)
  useExitCodes: boolean;        // camel alias
  debug: boolean;
  'list-adapters': boolean;
  listAdapters: boolean;        // camel alias
  'no-schema': boolean;
  noSchema: boolean;
  'skip-schema': boolean;
  skipSchema: boolean;  
};

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

// ---- helpers -------------------------------------------------------------

// Safe object check (already in your file)
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Detects artifact-style bundles (has artifacts or classic bundle fields) */
function isBundleArtifactLike(x: unknown): boolean {
  if (!isObject(x)) return false;
  const xo = x as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(xo, 'artifacts')) return true;

  const arts = isObject(xo['artifacts']) ? (xo['artifacts'] as Record<string, unknown>) : undefined;
  if (
    arts &&
    (Object.prototype.hasOwnProperty.call(arts, 'zkey') ||
     Object.prototype.hasOwnProperty.call(arts, 'wasm') ||
     Object.prototype.hasOwnProperty.call(arts, 'vkey') ||
     Object.prototype.hasOwnProperty.call(arts, 'proof'))
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(xo, 'bundleId') ||
    Object.prototype.hasOwnProperty.call(xo, 'verifier')
  ) {
    return true;
  }

  return false;
}

/** Detects inline verification-style inputs (vkey/proof/publicSignals present) */
function isInlineVerificationLike(x: unknown): boolean {
  if (!isObject(x)) return false;
  const xo = x as Record<string, unknown>;

  // top-level vkey
  const hasVkeyTop =
    Object.prototype.hasOwnProperty.call(xo, 'verificationKey') ||
    Object.prototype.hasOwnProperty.call(xo, 'vkey') ||
    Object.prototype.hasOwnProperty.call(xo, 'vk');

  // verifier.vkey
  const verifier = isObject(xo['verifier']) ? (xo['verifier'] as Record<string, unknown>) : undefined;
  const hasVkeyVerifier = verifier
    ? (Object.prototype.hasOwnProperty.call(verifier, 'verificationKey') ||
       Object.prototype.hasOwnProperty.call(verifier, 'vkey') ||
       Object.prototype.hasOwnProperty.call(verifier, 'vk'))
    : false;

  // result.proof / result.publicSignals OR top-level publics
  const result = isObject(xo['result']) ? (xo['result'] as Record<string, unknown>) : undefined;
  const hasProof = result ? isObject(result['proof']) : false;
  const hasPublics =
    (result ? Array.isArray(result['publicSignals']) : false) ||
    Array.isArray(xo['publicSignals']) ||
    Array.isArray(xo['publicInputs']);

  const hasArtifacts = Object.prototype.hasOwnProperty.call(xo, 'artifacts');

  // Inline means: some inline bits present AND no artifacts object
  return (hasVkeyTop || hasVkeyVerifier || hasProof || hasPublics) && !hasArtifacts;
}

function isErrorOutcome<A extends string>(o: VerifyOutcome<A>): o is Extract<VerifyOutcome<A>, { ok: false }> {
  return o.ok === false;
}

function errnoCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const anyObj = err as Record<string, unknown>;
  return typeof anyObj.code === 'string' ? anyObj.code : undefined;
}

function isProofBundleLike(x: unknown): boolean {
  if (!isObject(x)) return false;
  const s = typeof x.$schema === 'string' ? x.$schema.toLowerCase() : '';
  if (s.includes('proofbundle') || s.includes('proof-bundle')) return true;

  const rt = typeof x.recordType === 'string' ? x.recordType.toLowerCase() : '';
  if (rt.includes('bundle')) return true;

  if ('bundleId' in x || 'artifacts' in x || 'verifier' in x || 'result' in x) return true;
  if ('proof' in x || 'publicInputs' in x || 'publicSignals' in x) return true;

  return false;
}

/** Map legacy/canonical IDs to new URN if needed */
function normalizeSchemaRef(s?: string): string | undefined {
  if (!s) return;
  const t = s.trim();
  if (t.startsWith('urn:zkpip:mvs:schemas:')) return t;

  switch (t) {
    case CANONICAL_IDS.proofBundle:  return 'urn:zkpip:mvs:schemas:proofBundle.schema.json';
    case CANONICAL_IDS.verification: return 'urn:zkpip:mvs:schemas:verification.schema.json';
    case CANONICAL_IDS.cir:          return 'urn:zkpip:mvs:schemas:cir.schema.json';
    case CANONICAL_IDS.issue:        return 'urn:zkpip:mvs:schemas:issue.schema.json';
    case CANONICAL_IDS.ecosystem:    return 'urn:zkpip:mvs:schemas:ecosystem.schema.json';
    case CANONICAL_IDS.core:         return 'urn:zkpip:mvs:schemas:core.schema.json';
    default: return undefined;
  }
}

/** Heuristic adapter pick when --adapter is not given */
function guessAdapterIdFromInput(input: unknown): AdapterId | undefined {
  if (!isObject(input)) return undefined;

  const ps =
    (typeof input.proofSystem === 'string' && input.proofSystem.toLowerCase()) ||
    (isObject(input.meta) && typeof input.meta.proofSystem === 'string' && input.meta.proofSystem.toLowerCase()) ||
    (isObject(input.verifier) && typeof input.verifier.proofSystem === 'string' && input.verifier.proofSystem.toLowerCase()) ||
    '';

  const fw =
    (typeof input.framework === 'string' && input.framework.toLowerCase()) ||
    (isObject(input.meta) && typeof input.meta.framework === 'string' && input.meta.framework.toLowerCase()) ||
    (isObject(input.verifier) && typeof input.verifier.framework === 'string' && input.verifier.framework.toLowerCase()) ||
    '';

  // Minimal mapping for Stage-1
  if (ps === 'groth16' && (fw === '' || fw === 'snarkjs')) {
    return (availableAdapterIds as readonly string[]).includes('snarkjs-groth16')
      ? 'snarkjs-groth16'
      : undefined;
  }

  // If only one adapter exists, pick it as a fallback
  if (availableAdapterIds.length === 1) {
    return availableAdapterIds[0];
  }

  return undefined;
}

/** Try to extract a bundle path from a "verification" JSON */
function pickBundlePathFromVerification(input: unknown, baseDir: string): string | undefined {
  if (!isObject(input)) return undefined;

  const direct =
    (typeof input.bundle === 'string' && input.bundle) ||
    (isObject(input.meta) && typeof input.meta.bundle === 'string' && input.meta.bundle) ||
    undefined;

  if (typeof direct === 'string') {
    return path.resolve(baseDir, direct);
  }

  return undefined;
}

/** Flush stdout/stderr, then exit immediately (for prompt friendliness). */
function exitNow(code: VerifyExit): void {
  try {
    process.stdout.write('', () => {
      process.stderr.write('', () => process.exit(code));
    });
  } catch {
    process.exit(code);
  }
}

// ---- yargs builder -------------------------------------------------------

export const builder = (y: Argv<object>) =>
  y
    .option('bundle', {
      type: 'string',
      describe: 'Path to a proof-bundle JSON file',
    })
    .option('verification', {
      type: 'string',
      describe: 'Path to a verification JSON file (can reference a bundle path)',
    })
    .option('adapter', {
      type: 'string',
      describe: 'Adapter id (e.g. snarkjs-groth16). If omitted, we try to guess.',
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
    .option('use-exit-codes', {
      type: 'boolean',
      default: false,
      describe: 'Alias for --exit-codes',
    })
    .option('debug', {
      type: 'boolean',
      default: false,
      describe: 'Verbose error output on failures',
    })
    .option('no-schema', {
      type: 'boolean',
      default: false,
      describe: 'Skip MVS schema validation (useful for CI smoke)',
    })
    .option('skip-schema', {
      type: 'boolean',
      default: false,
      describe: 'Alias for --no-schema',
    })    
    .parserConfiguration({ 'camel-case-expansion': true })
    .check((argv) => {
      if (argv.listAdapters) return true;
      if (!argv.bundle && !argv.verification) {
        throw new Error('Provide --bundle or --verification');
      }
      return true;
    }) as unknown as Argv<VerifyArgs>;

// ---- handler -------------------------------------------------------------

export async function handler(argv: ArgumentsCamelCase<VerifyArgs>): Promise<void> {
  let inputPath = '';

  // Normalize flags
  const wantJson = !!argv.json;
  const wantDebug = !!argv.debug;
  const useExitCodes = !!(argv['exit-codes'] || argv.exitCodes || argv['use-exit-codes'] || argv.useExitCodes);
  const wantList = !!(argv['list-adapters'] || argv.listAdapters);
  const skipSchema =
    !!argv['no-schema'] || !!argv.noSchema || !!argv['skip-schema'] || !!argv.skipSchema ||
    process.env.ZKPIP_SKIP_SCHEMA === '1';  

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

  // Early exit: list adapters
  if (wantList) {
    const rows = (await getAllAdapters()).map((a) => ({
      id: a.id,
      proofSystem: a.proofSystem ?? '',
      framework: a.framework ?? '',
    }));
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, adapters: rows }, null, 2));
    } else {
      console.table(rows);
    }
    if (useExitCodes) exitNow(0);
    return;
  }

  try {
    // Read & parse input JSON (either bundle or verification)
    inputPath = path.resolve(String(argv.bundle ?? argv.verification));
    const raw = fs.readFileSync(inputPath, 'utf8');
    const input = JSON.parse(raw) as unknown;

    // 1) Schema validation via canonical IDs
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const declared =
      isObject(input) && typeof input.$schema === 'string'
        ? String(input.$schema)
        : undefined;

    const normalized = normalizeSchemaRef(declared);
    const looksBundleArtifacts = isBundleArtifactLike(input);
    const looksInline = isInlineVerificationLike(input);

    let schemaId: string;
    if (normalized && normalized.includes('proofBundle.schema.json') && !looksBundleArtifacts) {
      // deklaráltan bundle, de nincs artifacts → mégis verification
      schemaId = 'urn:zkpip:mvs:schemas:verification.schema.json';
    } else {
      schemaId = normalized
        ?? (looksBundleArtifacts ? 'urn:zkpip:mvs:schemas:proofBundle.schema.json'
                                : 'urn:zkpip:mvs:schemas:verification.schema.json');
    }

    if (!skipSchema) {
      const validate = ajv.getSchema(schemaId) ?? ajv.compile({ $ref: schemaId });
      const valid = !!validate(input);
      if (!valid) {
        emit({
          ok: false,
          stage: 'schema',
          schemaRef: schemaId,
          errors: validate.errors ?? [],
          message: 'Input failed MVS schema validation.',
          debug: wantDebug ? { file: inputPath, chosenSchema: schemaId, looksBundleArtifacts, looksInline } : undefined,
        });
        if (useExitCodes) exitNow(3);
        return;
      }
    } else if (wantDebug) {
      console.error('[verify] schema validation skipped (CI smoke), chosen schema would be:', schemaId);
    }    

    if (wantDebug) {
      console.error('[verify] chosen schema:', schemaId, '(declared:', declared,
                    'bundleArtifacts:', looksBundleArtifacts, 'inline:', looksInline, ')');
    }

    if (wantDebug) {
      console.error(
        '[verify] chosen schema:',
        schemaId,
        '(declared:', declared,
        'bundleArtifacts:', looksBundleArtifacts,
        'inline:', looksInline,
        ')'
      );
    }

    const validate = ajv.getSchema(schemaId) ?? ajv.compile({ $ref: schemaId });
    const valid = !!validate(input);
    if (!valid) {
      emit({
        ok: false,
        stage: 'schema',
        schemaRef: schemaId,
        errors: validate.errors ?? [],
        message: 'Input failed MVS schema validation.',
        debug: wantDebug ? { file: inputPath, chosenSchema: schemaId, looksBundleArtifacts, looksInline } : undefined,
      });
      if (useExitCodes) exitNow(3);
      return;
    }

    // 2) Determine adapter id
    let adapterId: AdapterId | undefined;
    if (argv.adapter) {
      const candidate = String(argv.adapter);
      if ((availableAdapterIds as readonly string[]).includes(candidate)) {
        adapterId = candidate as AdapterId;
      } else {
        const all = await getAllAdapters();
        emit({
          ok: false,
          stage: 'adapter',
          message: `Adapter not found: ${candidate}`,
          debug: wantDebug ? { available: all.map((a) => a.id) } : undefined,
        });
        if (useExitCodes) exitNow(2);
        return;
      }
    } else {
      adapterId = guessAdapterIdFromInput(input);
      if (!adapterId) {
        const sniff = isObject(input)
          ? {
              proofSystem:
                (typeof input.proofSystem === 'string' && input.proofSystem) ||
                (isObject(input.meta) && typeof input.meta.proofSystem === 'string' && input.meta.proofSystem) ||
                undefined,
              framework:
                (typeof input.framework === 'string' && input.framework) ||
                (isObject(input.meta) && typeof input.meta.framework === 'string' && input.meta.framework) ||
                undefined,
            }
          : undefined;

        emit({
          ok: false,
          stage: 'adapter',
          message: 'No suitable adapter found. Provide --adapter.',
          debug: wantDebug ? { sniff, available: (await getAllAdapters()).map((a) => a.id) } : undefined,
        });
        if (useExitCodes) exitNow(2);
        return;
      }
    }

    const adapter = await getAdapterById(adapterId);
    if (!adapter) {
      emit({
        ok: false,
        stage: 'adapter',
        message: `Adapter not loadable: ${adapterId}`,
      });
      if (useExitCodes) exitNow(2);
      return;
    }

    // 3) Resolve bundle path for adapter.verify()
    let bundlePath: string | undefined;
    if (looksBundleArtifacts || looksInline) {
      // inline és artifacts-os esetben is a *jelenlegi fájl* a forrás
      bundlePath = inputPath;
    } else {
      // csak a „hivatkozó” verification-ben próbálunk bundle path-ot kivenni
      bundlePath = pickBundlePathFromVerification(input, path.dirname(inputPath));
    }

    if (!bundlePath) {
      emit({
        ok: false,
        stage: 'io',
        message: 'Could not determine bundle path (use --bundle or add "bundle" path in verification JSON).',
        debug: wantDebug ? { file: inputPath } : undefined,
      });
      if (useExitCodes) exitNow(4);
      return;
    }

    // 4) Run verification by bundle path
    let res: VerifyOutcome<typeof adapter.id>;
    try {
      res = await adapter.verify(bundlePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res = { ok: false, adapter: adapter.id, error: 'adapter_error', message: msg };
    }

    if (wantJson) {
      console.log(JSON.stringify(res, null, 2));
    } else if (isErrorOutcome(res)) {
      console.error(`❌ verify failed [${res.adapter}] ${res.error ?? ''} ${res.message ?? ''}`.trim());
    } else {
      console.log(`✅ verify ok [${res.adapter}]`);
    }

    if (useExitCodes) exitNow(res.ok ? 0 : 1);
  } catch (err) {
    const code = errnoCode(err);
    const friendlyCodes = new Set(['ENOENT', 'EISDIR', 'EACCES', 'EPERM']);
    const friendly = code ? friendlyCodes.has(code) : false;

    const inputHint = inputPath || '(unknown path)';

    emit({
      ok: false,
      stage: 'io',
      error: code ?? String((err as Error)?.message ?? err),
      message: friendly
        ? `Input file not readable: ${inputHint} (${code})`
        : 'Failed to read or process the input file.',
      debug: wantDebug
        ? friendly
          ? { file: inputHint }
          : String((err as Error)?.stack ?? err)
        : undefined,
    });

    if (useExitCodes) exitNow(4);
  }
}

// Optional: keep a CommandModule export if your CLI index expects it.
export const verifyCmd: CommandModule<object, VerifyArgs> = {
  command: 'verify',
  describe: 'Verify a proof bundle or a verification JSON input',
  builder,
  handler,
};
