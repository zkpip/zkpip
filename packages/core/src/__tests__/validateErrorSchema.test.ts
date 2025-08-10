import { describe, it, expect } from 'vitest';
import { makeAjv } from '../validation/ajv.js';

describe('error.schema.json', () => {
  // makeAjv() already registers all schemas, so we can fetch it directly
  const ajv = makeAjv();
  const validate = ajv.getSchema('https://zkpip.org/schemas/error.schema.json')!;

  it('accepts a valid error entry', () => {
    const data = {
      id: 'err-001',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'proof-verification',
      tech: 'groth16',
      title: 'Pairing check reverts on valid proof',
      summary:
        'Observed verifier revert when verifying known-good Groth16 proof due to incorrect G2 point order.',
      evidence: {
        repo: 'org/repo',
        issueUrl: 'https://github.com/org/repo/issues/123',
      },
      severity: 'high',
    };
    expect(validate(data)).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    const data = {
      id: 'err-002',
      createdAt: '2025-08-10T10:25:00.000Z',
      category: 'tooling',
      tech: 'noir',
      title: 'nargo build fails',
      summary:
        'Build fails on CI runners with inconsistent resolver cache when using workspace crates.',
      evidence: {
        issueUrl: 'https://github.com/org/repo/issues/999',
      },
      severity: 'medium',
    } as any;
    expect(validate(data)).toBe(false);
  });

  it('rejects when severity is not in the enum', () => {
    const data = {
      id: 'err-003',
      createdAt: '2025-08-10T10:30:00.000Z',
      category: 'witness',
      tech: 'halo2',
      title: 'Invalid witness data',
      summary: 'Too short',
      evidence: { repo: 'org/repo' },
      severity: 'blocker', // not in the enum
    } as any;
    expect(validate(data)).toBe(false);
  });
});
