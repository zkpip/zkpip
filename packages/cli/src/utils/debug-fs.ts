// ESM, strict TS. Optional FS operation logging to STDERR.
// Controlled by env vars, disabled by default to keep tests clean.

type Level = 'info' | 'debug';

const LOG_ENABLED = process.env.ZKPIP_FS_LOG === '1' || process.env.ZKPIP_FS_LOG === 'true';
const LOG_LEVEL: Level = (process.env.ZKPIP_FS_LOG_LEVEL === 'debug' ? 'debug' : 'info');
const MATCH_RAW = process.env.ZKPIP_FS_LOG_MATCH;
let MATCH_RE: RegExp | null = null;

if (MATCH_RAW) {
  // Accept "/pattern/" or plain "pattern"
  const trimmed = MATCH_RAW.trim();
  const body = trimmed.startsWith('/') && trimmed.endsWith('/') ? trimmed.slice(1, -1) : trimmed;
  try { MATCH_RE = new RegExp(body); } catch { /* ignore invalid regex */ }
}

function shouldLog(targetPath: string): boolean {
  if (!LOG_ENABLED) return false;
  if (MATCH_RE) return MATCH_RE.test(targetPath);
  return true;
}

export function logFs(op: string, targetPath: string, extra?: Record<string, unknown>): void {
  if (!shouldLog(targetPath)) return;
  const base = { op, path: targetPath };
  const payload = LOG_LEVEL === 'debug' ? { ...base, ...extra } : base;
  // Use STDERR to avoid interfering with JSON stdout
  process.stderr.write(`[fs-compat] ${JSON.stringify(payload)}\n`);
}
