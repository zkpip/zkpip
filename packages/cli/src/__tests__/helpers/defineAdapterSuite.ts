// Factory that runs the same contract against any adapter and provider.

import { describe, it, expect } from 'vitest';
import type { VectorId, VectorProvider } from './canvectors.types.js';

export interface Adapter {
  // Your current adapter.verify signature
  verify(input: unknown): Promise<boolean>;
}

export interface SuiteCase {
  readonly id: VectorId;
  readonly expectOk: boolean;
}

export function defineAdapterContractSuite(
  title: string,
  adapter: Adapter,
  provider: VectorProvider,
  cases: readonly SuiteCase[],
): void {
  describe(title, () => {
    for (const c of cases) {
      const name = `${c.id} → ${c.expectOk ? 'ok' : 'verification_failed'}`;
      it(name, async () => {
        const vec = await provider.resolve(c.id);
        const ok = await adapter.verify(vec.verificationJson);
        expect(ok).toBe(c.expectOk);
      });
    }
  });
}
