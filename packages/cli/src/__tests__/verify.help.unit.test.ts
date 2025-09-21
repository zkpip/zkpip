// ESM, strict TS, no "any".
import { describe, it, expect, vi } from 'vitest';
import { runVerifyCli } from '../verify-cli.js';

function captureStdout() {
  const logs: string[] = [];
  const writes: string[] = [];

  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  });

  const writeSpy = vi
    .spyOn(process.stdout, 'write')
    // Node typings miatt a signature boolean-t vár; itt elfogadjuk és gyűjtjük a stringet
    .mockImplementation(((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as unknown as typeof process.stdout.write);

  return {
    restore: () => {
      logSpy.mockRestore();
      writeSpy.mockRestore();
    },
    output: () => (logs.join('\n') + '\n' + writes.join('')).trim(),
    logSpy,
    writeSpy,
  };
}

describe('verify help (unit)', () => {
  it('prints help with epilogue via --help', async () => {
    const cap = captureStdout();
    try {
      await runVerifyCli(['--help']);
      const out = cap.output();
      // Minimális elvárások: usage + epilogue
      expect(out).toContain('zkpip verify');
      expect(out).toContain('Options');
      expect(out).toContain('Error codes:');       // epilogue
      expect(out).toContain('ZKPIP_HARD_EXIT=1');  // epilogue
    } finally {
      cap.restore();
    }
  });

  it('also prints help for -h', async () => {
    const cap = captureStdout();
    try {
      await runVerifyCli(['-h']);
      const out = cap.output();
      expect(out).toContain('zkpip verify');
      expect(out).toContain('Error codes:');
    } finally {
      cap.restore();
    }
  });

  it('accepts `help` as first arg', async () => {
    const cap = captureStdout();
    try {
      await runVerifyCli(['help']);
      const out = cap.output();
      expect(out).toContain('zkpip verify');
      expect(out).toContain('Error codes:');
    } finally {
      cap.restore();
    }
  });
});
