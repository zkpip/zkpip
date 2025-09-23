export interface VerifyArgs {
  /** Path to verification JSON or '-' for stdin, or inline JSON object (already parsed) */
  verification?: unknown;
  /** Optional dump root (dir or file path); empty = disabled */
  dumpNormalized?: string;
  /** Common flags used elsewhere (add more as needed, all optional to keep it flexible) */
  json?: boolean;
  useExitCodes?: boolean;
  adapter?: string; 
}