// ESM-safe JSON writers; never pretty-print; safe under strict lint.
// No `any` usage; accept `unknown` and swallow write errors on purpose.

export function writeJsonStdout(obj: unknown): void {
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // Intentionally ignore: exit code is set by the command handler.
  }
}

export function writeJsonStderr(obj: unknown): void {
  try {
    process.stderr.write(JSON.stringify(obj));
  } catch {
    // Intentionally ignore: exit code is set by the command handler.
  }
}
