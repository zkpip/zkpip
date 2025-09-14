// Canonical CLI types for verify/adapters commands (ESM + strict, no `any`)

export interface VerifyHandlerArgs {
  adapter?: string;
  verification?: string; // file path or raw JSON string
  bundle?: string; // legacy alias for verification

  json?: boolean;

  // Exit-code aliases (both kebab and camel are accepted)
  useExitCodes?: boolean;
  exitCodes?: boolean;
  'use-exit-codes'?: boolean;
  'exit-codes'?: boolean;

  // Schema skip flag (both spellings)
  noSchema?: boolean;
  'no-schema'?: boolean;
}

/** Shared exit-code flags for all CLI commands. */
export interface ExitCodeFlags {
  useExitCodes?: boolean;
  exitCodes?: boolean;
  'use-exit-codes'?: boolean;
  'exit-codes'?: boolean;
}

/** Shared JSON toggle flag. */
export interface JsonFlag {
  json?: boolean;
}

/** Args shape for the `adapters` command. */
export type AdaptersHandlerArgs = JsonFlag & ExitCodeFlags;

export type VerifyOk = {
  ok: true;
  adapter?: string;
  proofSystem?: string;
  framework?: string;
};

export type VerifyErr = {
  ok: false;
  error:
    | 'verification_failed'
    | 'adapter_not_found'
    | 'schema_invalid'
    | 'io_error'
    | 'adapter_error';
  message?: string;
  stage?: 'io' | 'schema' | 'verify' | string;
};

export type VerifyOutcomeU = VerifyOk | VerifyErr;
