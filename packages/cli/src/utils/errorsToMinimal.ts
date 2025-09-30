// packages/cli/src/utils/errorsToMinimal.ts
// ESM, strict TS, no `any`.

export type AjvLikeError = Readonly<{
  instancePath: string;                 // JSON Pointer, pl. "/seal/signature"
  keyword: string;                      // "required" | "type" | "enum" | ...
  message?: string;                     // AJV default msg
  schemaPath?: string;
  params?: Readonly<Record<string, unknown>>; // keyword-spec. params
}>;

export type MinimalErr = Readonly<{
  path: string;             // már előre normalizált útvonal (pl. "/", "/seal/urn")
  keyword: string;
  message?: string;
}>;

type ErrLike = AjvLikeError | MinimalErr;

export type MinimalErrors = Readonly<{
  lines: readonly string[];
  more: number;
}>;

export function errorsToMinimal(
  errors: readonly ErrLike[] | null | undefined,
  max = 3,
): MinimalErrors {
  if (!errors || errors.length === 0) return { lines: [], more: 0 };

  const lines: string[] = [];
  for (const e of errors) {
    const rawPath = 'instancePath' in e ? e.instancePath : e.path;
    const p = normalizePath(rawPath);

    switch (e.keyword) {
      case 'required': {
        const miss = getParamString(('params' in e ? e.params : undefined), 'missingProperty');
        lines.push(`${p}: missing required property ${quote(miss)}`);
        break;
      }
      case 'additionalProperties': {
        const ap = getParamString(('params' in e ? e.params : undefined), 'additionalProperty');
        lines.push(`${p}: unknown property ${quote(ap)} is not allowed`);
        break;
      }
      case 'enum': {
        const allowed = getParamArray(('params' in e ? e.params : undefined), 'allowedValues', 5);
        lines.push(`${p}: must be one of ${allowed.join(', ')}`);
        break;
      }
      case 'type': {
        const expected = getParamString(('params' in e ? e.params : undefined), 'type');
        lines.push(`${p}: must be of type ${expected}`);
        break;
      }
      case 'const': {
        lines.push(`${p}: must equal the expected value`);
        break;
      }
      case 'minItems': {
        const mi = getParamNumber(('params' in e ? e.params : undefined), 'minItems');
        lines.push(`${p}: must contain at least ${mi} item(s)`);
        break;
      }
      case 'maxItems': {
        const ma = getParamNumber(('params' in e ? e.params : undefined), 'maxItems');
        lines.push(`${p}: must contain no more than ${ma} item(s)`);
        break;
      }
      case 'minLength': {
        const ml = getParamNumber(('params' in e ? e.params : undefined), 'minLength');
        lines.push(`${p}: must be at least ${ml} character(s)`);
        break;
      }
      case 'maxLength': {
        const ml = getParamNumber(('params' in e ? e.params : undefined), 'maxLength');
        lines.push(`${p}: must be at most ${ml} character(s)`);
        break;
      }
      case 'pattern': {
        lines.push(`${p}: does not match the required pattern`);
        break;
      }
      case 'format': {
        const fmt = getParamString(('params' in e ? e.params : undefined), 'format');
        lines.push(`${p}: must match format ${fmt}`);
        break;
      }
      default: {
        const msg = e.message ? e.message : `failed at keyword "${e.keyword}"`;
        lines.push(`${p}: ${msg}`);
        break;
      }
    }

    if (lines.length >= max) break;
  }

  const more = Math.max(0, errors.length - lines.length);
  return { lines, more };
}

/* --------------------------------- utils ---------------------------------- */

function normalizePath(ptr: string): string {
  // AJV instancePath JSON Pointer
  // "" (root) → "$"  (marad a régi UX)
  if (!ptr || ptr.length === 0) return '$';
  return ptr;
}

function quote(x: string): string {
  return x.length ? `"${x}"` : '""';
}

function getParamString(
  params: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string {
  const v = params?.[key];
  return typeof v === 'string' ? v : '';
}

function getParamNumber(
  params: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number {
  const v = params?.[key];
  return typeof v === 'number' ? v : Number.NaN;
}

function getParamArray(
  params: Readonly<Record<string, unknown>> | undefined,
  key: string,
  cap = 5,
): string[] {
  const v = params?.[key];
  if (!Array.isArray(v)) return [];
  const shown = v.slice(0, cap).map(prettyVal);
  if (v.length > cap) shown.push(`…+${v.length - cap} more`);
  return shown;
}

function prettyVal(x: unknown): string {
  const t = typeof x;
  if (t === 'string') return `"${x}"`;
  if (t === 'number' || t === 'bigint' || t === 'boolean') return String(x);
  if (x === null) return 'null';
  return '[object]';
}
