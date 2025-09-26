// Intentionally exit the process after best-effort stdio flush.
// No `any`, ESM-safe, and satisfies no-empty by doing a no-op in catch blocks.
export function exitNow(code: number): never {
  // Try to touch stdout/stderr so streams are initialized/flushed.
  try {
    process.stdout.write('');
  } catch {
    // Intentionally ignored: nothing meaningful to do on flush errors.
    void 0;
  }
  try {
    process.stderr.write('');
  } catch {
    // Intentionally ignored: nothing meaningful to do on flush errors.
    void 0;
  }

  process.exit(code);

  // In case `process.exit` is mocked in tests, keep the `never` contract.
  throw new Error(`process.exit(${code}) returned unexpectedly`);
}
