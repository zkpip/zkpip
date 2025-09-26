import { expect } from 'vitest';

type Res = { exitCode: number | null; stdout: string; stderr: string };

/** Expect 0; if not, dump stdout/stderr to help triage. */
export function expectExit0(r: Res): void {
  if (r.exitCode !== 0) {
    console.error('--- CLI FAST DEBUG ---');
    console.error('STDERR:\n', r.stderr);
    console.error('STDOUT:\n', r.stdout);
  }
  expect(r.exitCode).toBe(0);
}
