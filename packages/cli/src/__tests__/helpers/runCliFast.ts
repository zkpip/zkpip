import { runCli, type RunOptions, type RunResult } from './cliRunner.js';

/** Run CLI with fast (mocked/shortcut) runtime defaults. */
export async function runCliFast(
  args: readonly string[],
  options?: Omit<RunOptions, 'env'> & { env?: Record<string, string> },
): Promise<RunResult> {
  return runCli(args, {
    ...options,
    env: {
      ZKPIP_FAST_RUNTIME: '1',
      // keep logs off by default; flip to '1' locally if you want more noise
      ZKPIP_DEBUG: process.env.ZKPIP_DEBUG ?? '0',
      ...(options?.env ?? {}),
    },
  });
}
