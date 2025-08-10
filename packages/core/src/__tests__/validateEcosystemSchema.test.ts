// tests/validateEcosystemSchema.test.ts
import { describe, it, expect } from 'vitest';
import { makeAjv } from '../validation/ajv.js';

describe('ecosystem.schema.json', () => {
  const ajv = makeAjv();           
  const validate = ajv.getSchema('https://zkpip.org/schemas/ecosystem.schema.json');

  it('validál egy minimális, de valós objektumot', () => {
    const data = {
      id: 'aztec',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'Aztec',
      zkTech: 'zk-rollup',
      description: 'Zero-knowledge focused L2 with privacy-preserving smart contracts.'
    };
    expect(validate!(data)).toBe(true);
  });

  it('validál egy teljes, „dús” objektumot', () => {
    const data = {
      id: 'scroll',
      createdAt: '2025-08-10T10:05:00.000Z',
      updatedAt: '2025-08-10T10:10:00.000Z',
      project: 'Scroll',
      website: 'https://scroll.io',
      repo: 'scroll-tech/scroll',
      zkTech: 'zkEVM',
      languages: ['TypeScript', 'Solidity'],
      verifierAvailable: true,
      docs: 'https://docs.scroll.io',
      description:
        'zkEVM-based layer 2 focused on EVM equivalence with production-grade docs and tooling.'
    };
    expect(validate!(data)).toBe(true);
  });

  it('elutasítja, ha hiányzik egy kötelező mező (project)', () => {
    const data = {
      id: 'foo',
      createdAt: '2025-08-10T10:00:00.000Z',
      zkTech: 'whatever',
      description: 'This has no project field but should have.'
    };
    expect(validate!(data)).toBe(false);
  });

  it('elutasítja a hibás URI-t (website)', () => {
    const data = {
      id: 'bar',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'ZK Project',
      zkTech: 'barretenberg',
      website: 'not-a-uri',
      description: 'Long enough description to pass length requirements.'
    };
    expect(validate!(data)).toBe(false);
  });

  it('elutasítja a túl rövid leírást (description)', () => {
    const data = {
      id: 'baz',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'ShortDesc',
      zkTech: 'plonk',
      description: 'too short'
    };
    expect(validate!(data)).toBe(false);
  });
});
