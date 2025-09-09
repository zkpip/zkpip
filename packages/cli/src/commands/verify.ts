import fs from 'node:fs';
import { exitNow } from '../utils/exitNow.js';
import { getAdapterById, isAdapterId, type AdapterId } from '../registry/adapterRegistry.js';
import { errorMessage } from '../adapters/_shared.js';

// Narrow string → AdapterId (throws on unknown)
function toAdapterId(s: string): AdapterId {
  if (isAdapterId(s)) return s;
  throw new Error(`Unknown adapter: ${s}`);
}

// Accept dir path (pass-through), JSON file path (parse), inline JSON (parse),
// else raw string. Invalid JSON FILE should throw to be caught as stage:"io".
function resolveVerificationArg(raw: string): unknown {
  const s = raw.trim();

  // Inline JSON
  if (s.startsWith('{') || s.startsWith('[')) {
    return JSON.parse(s); // throw on invalid → stage:"io"
  }

  // Local path?
  let st: fs.Stats | undefined;
  try {
    st = fs.statSync(s);
  } catch {
    // Not a local path → hand over as-is (URL, etc.)
    return s;
  }

  if (st.isDirectory()) {
    // Directory is passed to adapter (dir triplet case)
    return s;
  }

  if (st.isFile()) {
    // IMPORTANT: do not swallow JSON.parse error → let it throw
    const txt = fs.readFileSync(s, 'utf8');
    return JSON.parse(txt); // throw on invalid → stage:"io"
  }

  // Fallback: pass through
  return s;
}

export type VerifyHandlerArgs = {
  adapter: string;
  verification?: string;
  json?: boolean;
  useExitCodes?: boolean;
  noSchema?: boolean;
};

// Keep return type Promise<void> so index.ts “handler: (a) => void|Promise<void>” elég
export async function verifyCommand(opts: VerifyHandlerArgs): Promise<void> {
  try {
    const adapterId = toAdapterId(opts.adapter);
    const adapter = await getAdapterById(adapterId);
    const input = resolveVerificationArg(opts.verification ?? '');

    const out = await adapter.verify(input);

    if (opts.json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(out));
    }

    if (out.ok) return exitNow(0);
    if (out.error === 'verification_failed') return exitNow(1);
    return exitNow(2);
  } catch (err: unknown) {
    const msg = errorMessage(err);
    if (opts.json) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          msg
            ? { ok: false, stage: 'io', error: 'adapter_error', message: msg }
            : { ok: false, stage: 'io', error: 'adapter_error' }
        )
      );
    }
    return exitNow(2);
  }
}

// <-- NEW: export a handler that index.ts elvár
export async function handler(argv: VerifyHandlerArgs): Promise<void> {
  await verifyCommand(argv);
}
