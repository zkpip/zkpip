// utils/errors.ts
import { ExitCode } from './exit.js';

export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? (e.message || e.toString()) : String(e);
}

function isNodeFsError(e: unknown): e is NodeJS.ErrnoException {
  if (e === null || typeof e !== 'object') return false;

  // Narrow to an object that may have a 'code' field
  const obj = e as { code?: unknown };

  return typeof obj.code === 'string';
  
  // return typeof obj.code === 'string' || typeof obj.code === 'number';
}

export function classifyExitCode(e: unknown): ExitCode {
  // I/O: Node FS errors
  if (isNodeFsError(e)) return ExitCode.IO_ERROR;

  // `new Error("Invalid JSON")`
  if (e instanceof SyntaxError) return ExitCode.SCHEMA_INVALID;

  // fallback
  return ExitCode.UNEXPECTED;
}
