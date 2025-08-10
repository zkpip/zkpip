import { describe, it, expect } from 'vitest';
import { makeAjv } from '../validation/ajv.js';

describe('error.schema.json (negative cases)', () => {
  const ajv = makeAjv();
  const validate = ajv.getSchema('https://zkpip.org/schemas/error.schema.json')!;

  it('rejects missing required field: evidence', () => {
    const data = {
      id: 'err-missing-evidence',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'tooling',
      tech: 'noir',
      title: 'Build fails',
      summary: 'This summary has enough length to pass the minLength rule.',
      severity: 'medium',
    } as any;
    expect(validate(data)).toBe(false);
  });

  it('rejects evidence without required repo', () => {
    const data = {
      id: 'err-no-repo',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'proof-verification',
      tech: 'groth16',
      title: 'Verifier regression',
      summary: 'Summary that is long enough for validation.',
      evidence: { issueUrl: 'https://github.com/org/repo/issues/7' },
      severity: 'high',
    } as any;
    expect(validate(data)).toBe(false);
  });

  it('rejects invalid issueUrl format in evidence', () => {
    const data = {
      id: 'err-bad-issue-url',
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

  it('rejects title shorter than minLength (3) and summary shorter than minLength (10)', () => {
    const data = {
      id: 'err-short-text',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'constraint-failure',
      tech: 'circom',
      title: 'Hi',     // too short
      summary: 'short', // too short
      evidence: { repo: 'org/repo' },
      severity: 'critical',
    };
    expect(validate(data)).toBe(false);
  });

  it('rejects severity outside the enum', () => {
    const data = {
      id: 'err-bad-severity',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'other',
      tech: 'other',
      title: 'Unsupported severity',
      summary: 'A sufficiently long summary for validation here.',
      evidence: { repo: 'org/repo' },
      severity: 'blocker', // not allowed
    } as any;
    expect(validate(data)).toBe(false);
  });

  it('rejects affectedVersions with non-string items', () => {
    const data = {
      id: 'err-bad-versions',
      createdAt: '2025-08-10T10:20:00.000Z',
      category: 'performance',
      tech: 'gnark',
      title: 'Slow proving times',
      summary: 'Observed significant slowdowns when switching proving backends.',
      evidence: { repo: 'org/repo' },
      severity: 'medium',
      affectedVersions: ['v1.0.0', 2], // invalid: number in items
    } as any;
    expect(validate(data)).toBe(false);
  });
});
