export const ExitCode = Object.freeze({ 
  OK: 0,
  UNEXPECTED: 1,
  IO_ERROR: 2,
  SCHEMA_INVALID: 3,
  VERIFY_ERROR: 4,
  INVALID_ARGS: 5
});

export class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CliError';
    this.code = code;
  }
}