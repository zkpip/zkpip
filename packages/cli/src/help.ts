// packages/cli/src/help.ts
// Keep comments in English only (OSS).

/** Fixed-width error codes table shown at the end of every help. */
export function errorHelpEpilogue(): string {
  return [
    '',
    'Error codes:',
    '  adapter_not_found     Selected adapter is not registered',
    '  schema_invalid        JSON does not conform to pinned schema',
    '  io_error              Failed to read/write a file or network stream',
    '  size_limit_exceeded   Vectors pull payload too large',
    '  http_blocked          http:// blocked without --allow-http',
    '  timeout               Read timeout exceeded',
    '  strict_violation      --strict forbids the given fields',
    '',
    'Env flags:',
    '  ZKPIP_HARD_EXIT=1     Hard exit (process.exit) on failures; soft otherwise',
  ].join('\n');
}

/** Top-level usage text (no yargs). */
export function topLevelUsage(): string {
  return [
    'Usage:',
    '  zkpip verify   --verification <path>|- [--adapter <id>] [--dump-envelope] [--use-exit-codes]',
    '  zkpip manifest <sign|verify> [options]',
    '  zkpip keys     [options]',
    '  zkpip forge    [options]',
    '  zkpip vectors  <pull|...> [options]',
    '',
    'Help:',
    '  zkpip --help',
    '  zkpip help <command>',
  ].join('\n');
}

/** Compose a final help string with epilogue appended. */
export function composeHelp(body: string): string {
  return `${body}\n${errorHelpEpilogue()}\n`;
}

/** Small helper for argv-based help detection in subcommands. */
export function shouldShowHelp(argv: readonly string[]): boolean {
  return argv.includes('--help') || argv.includes('-h') || argv[0] === 'help';
}
