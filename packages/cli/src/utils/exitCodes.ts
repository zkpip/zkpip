// Re-export shim to keep imports stable while using the canonical map.
export { mapVerifyOutcomeToExitCode as exitCodeFor } from './exitCodeMap.js';
export type { VerifyOutcomeU as ErrorOut } from '../types/cli.js';
