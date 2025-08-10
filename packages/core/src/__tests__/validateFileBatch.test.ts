import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { validateFileBatch } from '../cli/validate.js';

describe('validateFileBatch', () => {
  it('returns 0 for empty input', () => {
    const code = validateFileBatch([]);
    expect(code).toBe(0);
  });

  it('returns 1 for invalid JSON file (without noisy stderr)', () => {
    const tmp = join(process.cwd(), 'tmp-invalid.json');
    writeFileSync(tmp, '{ invalid', 'utf-8');

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const code = validateFileBatch([tmp]);
      expect(code).toBe(1);
      expect(spy).toHaveBeenCalled(); // optional: verify error was logged
    } finally {
      spy.mockRestore();
      try { unlinkSync(tmp); } catch { /* ignore */ }
    }
  });
});
