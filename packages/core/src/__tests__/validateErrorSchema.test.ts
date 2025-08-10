import { describe, it, expect } from 'vitest';
import type { ValidateFunction } from 'ajv';
import { makeAjv } from '../validation/ajv.js';

describe('error.schema.json', () => {
  const ajv = makeAjv();
  const schemaId = 'https://zkpip.org/schemas/error.schema.json';

  const maybeValidator = ajv.getSchema(schemaId);
  if (!maybeValidator) {
    throw new Error(`Error schema validator not found for $id: ${schemaId}`);
  }
  const validate: ValidateFunction<unknown> = maybeValidator;

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

  it('rejects when a required field is missing (evidence.repo)', () => {
    const data: unknown = {
      id: 'err-002',
      createdAt: '2025-08-10T10:25:00.000Z',
      category: 'tooling',
      tech: 'noir',
      title: 'nargo build fails',
      summary:
        'Build fails on CI runners with inconsistent resolver cache when using workspace crates.',
      evidence: {
        // repo is missing
        issueUrl: 'https://github.com/org/repo/issues/999',
      },
      severity: 'medium',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects invalid issueUrl format in evidence', () => {
    const data: unknown = {
      id: 'err-003',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'witness',
      tech: 'halo2',
      title: 'Witness edge case',
      summary: 'This is a sufficiently descriptive summary string.',
      evidence: { repo: 'org/repo', issueUrl: 'not-a-url' },
      severity: 'low',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects too short title/summary and out-of-enum severity', () => {
    const data: unknown = {
      id: 'err-004',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'constraint-failure',
      tech: 'circom',
      title: 'Hi', // too short
      summary: 'short', // too short
      evidence: { repo: 'org/repo' },
      severity: 'blocker', // not allowed
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects affectedVersions when items are not all strings', () => {
    const data: unknown = {
      id: 'err-005',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'performance',
      tech: 'gnark',
      title: 'Slow proving times',
      summary: 'Observed significant slowdowns when switching proving backends.',
      evidence: { repo: 'org/repo' },
      severity: 'medium',
      affectedVersions: ['v1.0.0', 2], // invalid number item
    };
    expect(validate(data)).toBe(false);
  });
});
