// Injects a shebang into dist/index.js and makes it executable.
// English comments, no CommonJS (ESM only).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const OUT = path.join(CLI_ROOT, 'dist', 'index.js');
const SHEBANG = '#!/usr/bin/env node\n';

async function main() {
  let src = await fs.readFile(OUT, 'utf8').catch(() => {
    throw new Error(`Cannot read ${OUT} – did you run "npm -w @zkpip/cli run build"?`);
  });

  if (!src.startsWith(SHEBANG)) {
    await fs.writeFile(OUT, SHEBANG + src, 'utf8');
  }
  await fs.chmod(OUT, 0o755);
  console.log(`Made executable: ${OUT}`);
}

main().catch((e) => {
  console.error('[make-executable] failed:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
