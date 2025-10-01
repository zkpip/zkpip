// ESM + NodeNext; no `any`.
// Single-line JSON outputs where applicable; strict exit-code mapping.

import { readFile } from 'node:fs/promises';
import type { VerifyHandlerArgs, VerifyErr, VerifyOutcomeU, VerifyOk } from '../types/cli.js';
import { getAdapterById, isAdapterId, type AdapterId } from '../registry/adapterRegistry.js';
import { errorMessage } from '../adapters/_shared.js';
import { computeUseExit, getVerificationRaw } from '../utils/argvFlags.js';
import { writeJsonStderr, writeJsonStdout } from '../utils/ioJson.js';
import { resolveVerificationArg } from '../utils/resolveVerificationArg.js';
import type { Json, JsonObject } from '../types/json.js';
import { mapVerifyOutcomeToExitCode } from '../utils/exitCodeMap.js';
import { normalizeVerification } from '../utils/normalizeVerification.js';
import { dumpNormalized } from '../utils/dumpNormalized.js';
import { isProofEnvelope } from '../verify/verificationLoader.js';
import { existsSync } from 'node:fs';
import { join, isAbsolute, dirname as pathDirname, sep } from 'node:path';
import { resolveDumpRoot } from '../utils/dumpRoot.js';
import { getDumpNormalizedArg, prettyVerificationPath } from './_internals/verify-argv.js';
import { repoJoin } from '../utils/paths.js';
import { K_VERIFICATION_JSON } from '../kinds.js';
import { ExitCode } from '../utils/exit.js';
import { finalizeExit } from '../utils/finalize.js';
function toAdapterId(s: string): AdapterId {
  if (isAdapterId(s)) return s;
  throw new Error(`Unknown adapter: ${s}`);
}

/** Small string helper */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

// adapter-id → default meta (fallback)
function defaultsForAdapter(adapterId: AdapterId): { curve: string; protocol: string } {
  switch (adapterId) {
    case 'snarkjs-groth16': return { curve: 'bn128', protocol: 'groth16' };
    case 'snarkjs-plonk':   return { curve: 'bn128', protocol: 'plonk' };
    case 'zokrates-groth16':return { curve: 'bn128', protocol: 'groth16' };
    default:                return { curve: 'bn128', protocol: 'groth16' };
  }
}

/** Narrow object check without using `any`. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** True if value is a plain JSON object (not null, not array). */
function isJsonObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fileUriToPath(uri: string): string | undefined {
  if (!uri.toLowerCase().startsWith('file://')) return undefined;
  return uri.replace(/^file:\/\//i, '');
}

/** Resolve vkey using uri/path with bounded, deterministic attempts (no deep walks). */
async function readVkeyFromArtifacts(
  envelope: Json,
  verificationFilePath: string | undefined,
): Promise<Json | undefined> {
  if (!isJsonObject(envelope)) return undefined;
  const arts = envelope['artifacts'];
  if (!isRecord(arts)) return undefined;

  // 1) Prefer absolute file:// URI
  const vkeyRec = (arts as Record<string, unknown>)['vkey'];
  if (isRecord(vkeyRec)) {
    const uri = vkeyRec['uri'];
    const absFromUri = fileUriToPath(typeof uri === 'string' ? uri : '');
    if (absFromUri && existsSync(absFromUri)) {
      const text = await readFile(absFromUri, 'utf8');
      return JSON.parse(text) as Json;
    }

    // 2) path handling
    const p = vkeyRec['path'];
    if (typeof p === 'string' && p.length > 0) {
      // 2a) absolute path
      if (isAbsolute(p) && existsSync(p)) {
        const text = await readFile(p, 'utf8');
        return JSON.parse(text) as Json;
      }
      // 2b) relative to verification file directory (if known)
      {
        const baseDir: string | undefined = verificationFilePath
          ? pathDirname(
              isAbsolute(verificationFilePath)
                ? verificationFilePath
                : pathResolve(process.cwd(), verificationFilePath)
            )
          : undefined;

        if (baseDir) {
          const cand = join(baseDir, p);
          if (existsSync(cand)) {
            const text = await readFile(cand, 'utf8');
            return JSON.parse(text) as Json;
          }
        }
      }
      // 2c) relative to CWD
      {
        const cand = join(process.cwd(), p);
        if (existsSync(cand)) {
          const text = await readFile(cand, 'utf8');
          return JSON.parse(text) as Json;
        }
      }
      // 2d) relative to repo root if starts with "packages/"
      if (typeof p === 'string' && (p.startsWith('packages/') || p.startsWith(`packages${sep}`))) {
        const cand = repoJoin(p);
        if (cand && existsSync(cand)) {
          const text = await readFile(cand, 'utf8');
          return JSON.parse(text) as Json;
        }
      }
    }
  }

  // 3) Fallback: artifacts.verificationPath (legacy)
  const verifPath = (arts as Record<string, unknown>)['verificationPath'];
  if (typeof verifPath === 'string' && verifPath.length > 0) {
    // 3a) absolute
    if (isAbsolute(verifPath) && existsSync(verifPath)) {
      const text = await readFile(verifPath, 'utf8');
      return JSON.parse(text) as Json;
    }
    // 3b) relative to verification file directory (if known)
    {
      const baseDir: string | undefined = verificationFilePath
        ? pathDirname(
            isAbsolute(verificationFilePath)
              ? verificationFilePath
              : pathResolve(process.cwd(), verificationFilePath)
          )
        : undefined;

      if (baseDir) {
        const cand = join(baseDir, verifPath);
        if (existsSync(cand)) {
          const text = await readFile(cand, 'utf8');
          return JSON.parse(text) as Json;
        }
      }
    }
    // 3c) relative to CWD
    {
      const cand = join(process.cwd(), verifPath);
      if (existsSync(cand)) {
        const text = await readFile(cand, 'utf8');
        return JSON.parse(text) as Json;
      }
    }
    // 3d) repo root + 'packages/...'
    if (typeof verifPath === 'string' && (verifPath.startsWith('packages/') || verifPath.startsWith(`packages${sep}`))) {
      const cand = repoJoin(verifPath);
      if (cand && existsSync(cand)) {
        const text = await readFile(cand, 'utf8');
        return JSON.parse(text) as Json;
      }
    }
  }

  return undefined;
}

function normalizeVerifyResult(res: unknown): boolean {
  if (typeof res === 'boolean') return res;
  if (res && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
    return Boolean((res as Record<string, unknown>).ok);
  }
  return Boolean(res);
}

export async function verifyCommand(argv: VerifyHandlerArgs): Promise<void> {
  const jsonMode = Boolean(argv.json);

  function emit(result: VerifyOutcomeU): void {
    const code = result.ok ? ExitCode.OK : mapVerifyOutcomeToExitCode(result);

    if (jsonMode) {
      (result.ok ? writeJsonStdout : writeJsonStderr)(result as VerifyOk & VerifyErr);
    } else {
      (result.ok ? console.log : console.error)(result.ok ? 'OK' : 'ERROR');
    }

    // Hard-exit ALWAYS to avoid open handles keeping the loop alive.
    finalizeExit(code);
  }

  let normalizedOut: VerifyOutcomeU;

  // 1) Adapter selection
  const adapterRaw = String(argv.adapter ?? '').trim();
  if (!adapterRaw) {
    normalizedOut = {
      ok: false,
      stage: 'adapter',
      error: 'adapter_not_found',
      message: 'Missing --adapter',
    };
    return emit(normalizedOut);
  }

  let adapterId: AdapterId;
  try {
    adapterId = toAdapterId(adapterRaw);
  } catch (err) {
    normalizedOut = {
      ok: false,
      stage: 'adapter',
      error: 'adapter_not_found',
      message: errorMessage(err) ?? `Unknown adapter: ${adapterRaw}`,
    };
    return emit(normalizedOut);
  }

  const adapter = await getAdapterById(adapterId);

  // Only enable dump if user asked OR env is set
  const userDump = getDumpNormalizedArg(argv);
  const envDump = (process.env.ZKPIP_DUMP_NORMALIZED ?? '').trim();
  const dumpEnabled = Boolean(userDump || envDump);

  const runRoot = dumpEnabled
    ? resolveDumpRoot(userDump ?? envDump, `verify-${Date.now()}`)
    : undefined;

  if (dumpEnabled && runRoot) {
    try {
      await dumpNormalized(
        adapterId,                
        'preExtract',
        {
          dirOverride: runRoot,
          meta: {
            inputKind: K_VERIFICATION_JSON,
            verificationPath: prettyVerificationPath(argv),
          },
        }
      );
    } catch (e) {
      console.error('[dumpNormalized:preExtract] skipped:', (e as Error).message);
    }
  }

  const raw = getVerificationRaw(argv);
  if (!raw) {
    normalizedOut = {
      ok: false,
      stage: 'io',
      error: 'io_error',
      message: 'Missing --verification',
    };
    return emit(normalizedOut);
  }

  // 3) Resolve and parse verification JSON
  let verificationJson: Json;
  let verificationPathResolved: string | undefined; 
  try {
    const resolved = await resolveVerificationArg(raw);
    if (typeof resolved === 'string') {
      verificationPathResolved = resolved; // <-- remember absolute/relative path
      const text = await readFile(resolved, 'utf8');
      verificationJson = JSON.parse(text) as Json;
    } else {
      verificationJson = resolved;
    }
  } catch (err) {
    normalizedOut = {
      ok: false,
      stage: 'io',
      error: 'io_error',
      message: errorMessage(err) ?? String(err),
    };
    return emit(normalizedOut);
  }

  // 3b) Quick schema precheck (when schema is enabled)
  const schemaDisabled = argv.noSchema === true;
  if (!schemaDisabled) {
    if (!isJsonObject(verificationJson)) {
      normalizedOut = {
        ok: false,
        stage: 'schema',
        error: 'schema_invalid',
        message: 'verification must be a JSON object (quick precheck)',
      };
      return emit(normalizedOut);
    }

    // If this is a ProofEnvelope (MVS v0.1.0), skip legacy precheck.
    // Envelope presence is validated by the adapter/AJV later.
    if (!isProofEnvelope(verificationJson as unknown)) {
      const fw = verificationJson['framework'];
      const ps = verificationJson['proofSystem'];
      if (typeof fw !== 'string' || typeof ps !== 'string') {
        normalizedOut = {
          ok: false,
          stage: 'schema',
          error: 'schema_invalid',
          message: 'missing framework/proofSystem in verification JSON (quick precheck)',
        };
        return emit(normalizedOut);
      }
    }
  }

  // 4.1) Normalize to adapter bundle shape
  // Envelope-aware: if input is a ProofEnvelope, extract from result.{proof, publicSignals}.
  // Otherwise fall back to legacy normalizer.

  let bundle: { verification_key: Json; proof: Json; public: Json };

  try {
    if (isProofEnvelope(verificationJson as unknown)) {
      // Envelope path
      const env = verificationJson as unknown as {
        proofSystem?: string;
        curve?: string;
        result: { proof: Json; publicSignals: Json };
      };

      // vkey load (pass the resolved verification file path you already captured)
      const maybeVkey = await readVkeyFromArtifacts(verificationJson, verificationPathResolved);
      if (!isJsonObject(maybeVkey)) {
        return emit({
          ok: false, stage: 'schema', error: 'schema_invalid',
          message: 'verification_key not found (artifacts.vkey.path|uri unresolved)',
        });
      }

      // If it's an object, clone it; otherwise start from empty {}
      const vkeyObj: JsonObject = isJsonObject(maybeVkey) ? { ...maybeVkey } : {};  

      // Normalize fields required by snarkjs adapter (avoids `.toUpperCase()` on undefined)
      const { curve: curveDef, protocol: protoDef } = defaultsForAdapter(adapterId);
      const envCurve = isNonEmptyString((verificationJson as JsonObject).curve)
        ? (verificationJson as JsonObject).curve
        : undefined;
      const envProto = isNonEmptyString((verificationJson as JsonObject).proofSystem)
        ? (verificationJson as JsonObject).proofSystem
        : undefined;

      // curve
      if (!isNonEmptyString((vkeyObj as Record<string, unknown>).curve)) {
        (vkeyObj as Record<string, unknown>).curve = envCurve ?? curveDef;
      }
      // protocol
      if (!isNonEmptyString((vkeyObj as Record<string, unknown>).protocol)) {
        (vkeyObj as Record<string, unknown>).protocol = envProto ?? protoDef;
      }

      // --- PUBLIC SIGNALS NORMALIZATION (FIX) ---
      const psRaw = env.result.publicSignals;

      // Normalize to a non-empty array for snarkjs adapters
      let publicsNorm: Json;
      if (Array.isArray(psRaw)) {
        publicsNorm = psRaw as Json;
      } else if (isRecord(psRaw)) {
        // object -> values as array
        // publicsNorm = Object.values(psRaw) as unknown as Json;
        publicsNorm = Object.keys(psRaw)
          .sort()
          .map((k) => (psRaw as Record<string, unknown>)[k]) as unknown as Json;
      } else if (psRaw == null) {
        publicsNorm = [] as unknown as Json;
      } else {
        publicsNorm = [psRaw] as unknown as Json;
      }

      // checking empty array
      if (!Array.isArray(publicsNorm) || (publicsNorm as unknown[]).length === 0) {
        return emit({
          ok: false,
          stage: 'schema',
          error: 'schema_invalid',
          message: 'publicSignals must be a non-empty array for snarkjs adapters',
        });
      }

      // Finally build the bundle
      bundle = {
        verification_key: vkeyObj,
        proof: env.result.proof,
        public: publicsNorm,
      };

    } else {
      // Legacy path
      bundle = normalizeVerification(verificationJson);
    }
  } catch (err) {
    return emit({
      ok: false,
      stage: 'schema',
      error: 'schema_invalid',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 4.2) Verify via adapter
  try {
    const res = await adapter.verify(bundle);
    const ok = normalizeVerifyResult(res);
    normalizedOut = ok
      ? ({ ok: true, adapter: adapterId } satisfies VerifyOk)
      : ({ ok: false, stage: 'verify', error: 'verification_failed' } satisfies VerifyErr);
  } catch (err) {
    const msg = errorMessage(err) ?? String(err);
    const isSchema =
      /\b(schema|ajv|json.?schema|invalid\s+type|required\s+(?:field|property)|additional\s+properties|must\s+be|expected|missing\s+(?:field|property)|TypeError|Cannot\s+read|cannot\s+destructure|undefined|null)\b/i.test(
        msg,
      );
    normalizedOut = isSchema
      ? { ok: false, stage: 'schema', error: 'schema_invalid', message: msg }
      : { ok: false, stage: 'verify', error: 'adapter_error', message: msg };
  }

  return emit(normalizedOut);
}

export async function handler(argv: VerifyHandlerArgs): Promise<void> {
  try {
    await verifyCommand(argv);
  } catch (err) {
    const out: VerifyErr = {
      ok: false,
      stage: 'verify',
      error: 'adapter_error',
      message: errorMessage(err) ?? String(err),
    };
    if (argv.json) writeJsonStderr(out);
    else console.error('ERROR:', out.message);
    if (computeUseExit(argv)) process.exitCode = mapVerifyOutcomeToExitCode(out);
  }
}
function pathResolve(arg0: string, verificationFilePath: string): string {
  void arg0;
  void verificationFilePath;
  throw new Error('Function not implemented.');
}

