import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function read(p: string) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('seal.schema.json snapshot', () => {
  it('matches the committed snapshot', () => {
    const root = path.resolve(__dirname, '../../../');
    const curr = read(path.join(root, 'core/schemas/mvs/seal.schema.json'));
    const snap = read(path.join(root, 'core/schemas/mvs/__snapshots__/seal.schema.v1.snapshot.json'));
    expect(curr).toEqual(snap);
  });
});
