export function exitNow(code: number): never {
  try { process.stdout.write(''); } catch {}
  try { process.stderr.write(''); } catch {}
  process.exit(code);
}
