// Throws if any of the disallowed keys is present at top-level of the envelope.
export function assertDisallowedFields(obj: Record<string, unknown>): void {
  const disallowed = ['schema', 'id', 'artifactsPath', 'uri'];
  const hits = disallowed.filter(k => Object.prototype.hasOwnProperty.call(obj, k));
  if (hits.length > 0) {
    const msg = `Strict mode: disallowed field(s): ${hits.join(', ')}`;
    const err = new Error(msg);
    (err as Error & { code: string }).code = 'ZK_CLI_ERR_STRICT_FIELDS';
    throw err;
  }
}
