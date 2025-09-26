import { describe, it, expect } from 'vitest';
import { assertDisallowedFields } from '../utils/assertDisallowedFields.js';

describe('assertDisallowedFields', () => {
  it('throws when disallowed fields are present at top-level', () => {
    const bad = { $schema: 'x', artifactsPath: '/tmp', ok: true };
    expect(() => assertDisallowedFields(bad)).toThrow(/disallowed field/i);
  });

  it('passes when no disallowed fields exist', () => {
    const good = { ok: true };
    expect(() => assertDisallowedFields(good)).not.toThrow();
  });
});
