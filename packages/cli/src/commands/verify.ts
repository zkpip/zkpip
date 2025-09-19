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

function toAdapterId(s: string): AdapterId {
  if (isAdapterId(s)) return s;
  throw new Error(`Unknown adapter: ${s}`);
}

function isJsonObject(j: Json): j is JsonObject {
  return typeof j === 'object' && j !== null && !Array.isArray(j);
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
    const code = result.ok ? 0 : mapVerifyOutcomeToExitCode(result);

    if (jsonMode) {
      (result.ok ? writeJsonStdout : writeJsonStderr)(result as VerifyOk & VerifyErr);
    } else {
      (result.ok ? console.log : console.error)(result.ok ? 'OK' : 'ERROR');
    }

    if (result.ok) {
      // success → don’t hard-exit, just set exitCode
      process.exitCode = 0;
      return;
    }
    // failure → exit with mapped code (ensures execa sees non-zero)
    process.exit(code);
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

  // 2) Raw verification input (path or inline JSON)
  await dumpNormalized(adapterId, 'preExtract', {
    meta: {
      inputKind: 'verification-json',
      verificationPath: getVerificationRaw(argv),
    },
  });

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
  try {
    const resolved = await resolveVerificationArg(raw);
    if (typeof resolved === 'string') {
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

  // 4.1) Normalize to adapter bundle shape
  let bundle: { verification_key: Json; proof: Json; public: Json };
  try {
    bundle = normalizeVerification(verificationJson);
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
