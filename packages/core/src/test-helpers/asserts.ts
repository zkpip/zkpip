// Helper to stringify a failure regardless of payload shape
export function stringifyFail(res: { ok: boolean } & Record<string, unknown>): string {
  if (res.ok) return '';
  const errors = (res as { errors?: { instancePath?: string; message?: string }[] }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map(e => `${e.instancePath ?? ''}: ${e.message ?? ''}`).join('\n');
  }
  return String((res as { text?: string }).text ?? '');
}