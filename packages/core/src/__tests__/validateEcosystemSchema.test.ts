import { describe, it, expect } from 'vitest';
import type { ValidateFunction } from 'ajv';
import { makeAjv } from '../validation/ajv.js';

describe('ecosystem.schema.json', () => {
  const ajv = makeAjv();
  const schemaId = 'https://zkpip.org/schemas/ecosystem.schema.json';

  const maybeValidator = ajv.getSchema(schemaId);
  if (!maybeValidator) {
    throw new Error(`Ecosystem schema validator not found for $id: ${schemaId}`);
  }
  const validate: ValidateFunction<unknown> = maybeValidator;

  it('validates a minimal but valid ecosystem object', () => {
    const data = {
      id: 'aztec',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'Aztec',
      zkTech: 'zk-rollup',
      description:
        'Zero-knowledge focused L2 with privacy-preserving smart contracts.',
    };
    expect(validate(data)).toBe(true);
  });

  it('validates a complete and detailed ecosystem object', () => {
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
        'zkEVM-based layer 2 focused on EVM equivalence with production-grade documentation and tooling.',
    };
    expect(validate(data)).toBe(true);
  });

  it('rejects when a required field (project) is missing', () => {
    const data: unknown = {
      id: 'foo',
      createdAt: '2025-08-10T10:00:00.000Z',
      zkTech: 'whatever',
      description: 'This entry has no project field but should have.',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects an invalid URI in website', () => {
    const data: unknown = {
      id: 'bar',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'ZK Project',
      zkTech: 'barretenberg',
      website: 'not-a-uri',
      description: 'Long enough description to pass length requirements.',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects a too short description', () => {
    const data: unknown = {
      id: 'baz',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'ShortDesc',
      zkTech: 'plonk',
      description: 'short',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects languages when not an array of strings', () => {
    const data: unknown = {
      id: 'bad-langs',
      createdAt: '2025-08-10T10:00:00.000Z',
      project: 'Valid Project',
      zkTech: 'circom',
      description: 'Long description content.',
      languages: [123, 'TypeScript'], // invalid number item
    };
    expect(validate(data)).toBe(false);
  });
});
