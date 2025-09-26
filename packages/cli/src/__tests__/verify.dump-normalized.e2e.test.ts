// packages/cli/src/__tests__/verify.dump-normalized.e2e.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { execa, execaNode } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const cliDist = resolve(here, '..', '..', 'dist', 'index.js');

async function ensureCliBuilt(): Promise<void> {
  if (!existsSync(cliDist)) {
    // Build only the CLI package; adjust if your scripts differ
    await execa('npm', ['run', 'build'], {
      cwd: resolve(here, '..', '..'),
      stdio: 'inherit'
    });
  }
}

beforeAll(async () => {
  await ensureCliBuilt();
});

describe('verify --dump-normalized writes a valid JSON file', () => {
  it('file exists and is JSON-parsable (even if verify fails)', async () => {
    const base = mkdtempSync(join(tmpdir(), 'zkpip-vrfy-'));
    try {
      const input = join(base, 'in.vector.json');
      const out = join(base, 'normalized.json');

      // minimal input
      writeFileSync(input, JSON.stringify({ b: 1, a: 2 }), 'utf8');

      // IMPORTANT: use the --verification flag
      const res = await execaNode(
        cliDist,
        ['verify', '--verification', input, '--dump-normalized', out, '--use-exit-codes', '--json'],
        { env: { ZKPIP_HARD_EXIT: '0' }, stdio: 'pipe', reject: false }
      );

      // Regardless of exit code, dump must exist (verify-cli writes it BEFORE verifyHandler)
      expect(existsSync(out)).toBe(true);

      const parsed = JSON.parse(readFileSync(out, 'utf8'));
      expect(typeof parsed).toBe('object');

      // sanity: CLI ran
      expect(typeof res.exitCode).toBe('number');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
