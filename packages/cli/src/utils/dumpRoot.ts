// packages/cli/src/utils/dumpRoot.ts
import { dirname, resolve } from 'node:path';
import { statSync } from 'node:fs';
import { mkPaths } from './paths.js';

export function resolveDumpRoot(userPath: string, runLabel: string): string {
  const { tmpDir } = mkPaths();
  if (!userPath || userPath.trim() === '') return resolve(tmpDir, runLabel);

  const abs = resolve(process.cwd(), userPath);
  try {
    const st = statSync(abs);
    const baseDir = st.isDirectory() ? abs : dirname(abs);
    return resolve(baseDir, runLabel);
  } catch {
    return resolve(dirname(abs), runLabel);
  }
}
