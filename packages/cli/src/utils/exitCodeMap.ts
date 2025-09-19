// Map verify outcome → process exit code used by tests/CI.

import type { VerifyOutcomeU } from '../types/cli.js';

export function mapVerifyOutcomeToExitCode(out: VerifyOutcomeU): number {
  if (out.ok) return 0;

  const err = (out as { error?: unknown }).error;
  const stage = (out as { stage?: unknown }).stage;

  // Adapter kiválasztás / nem található
  if (err === 'adapter_not_found' || stage === 'adapter') return 4;

  // I/O hibák
  if (stage === 'io') return 2;

  // Séma hibák: akkor is 3, ha a stage hiányzik, de az error= 'schema_invalid'
  if (stage === 'schema' || err === 'schema_invalid') return 3;

  // Kripto verifikációs bukás
  if (err === 'verification_failed' || stage === 'verify') return 1;

  // Fallback: bármely nem-ok → 1
  return 1;
}