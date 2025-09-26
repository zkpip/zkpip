#!/usr/bin/env node
// packages/cli/scripts/make-executable.mjs
// Robust postbuild: resolve CLI entry from package.json "bin" and make it executable.
// - Works with either "bin": "dist/index.js" or "bin": { "zkpip": "dist/commands/verifySeal.js" }
// - Adds shebang if missing, chmod +x

import { promises as fsp } from 'node:fs';
import { access, constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function pathExists(p) {
  return new Promise((res) => {
    access(p, constants.FOK, (err) => res(!err));
  });
}

async function main() {
  const pkgDir = resolve(__dirname, '..'); // packages/cli
  const pkgJsonPath = join(pkgDir, 'package.json');

  let pkg;
  try {
    const raw = await fsp.readFile(pkgJsonPath, 'utf8');
    pkg = JSON.parse(raw);
  } catch (e) {
    console.error(`[make-executable] failed: cannot read ${pkgJsonPath}:`, e?.message || e);
    process.exit(1);
  }

  let binRel;
  if (typeof pkg.bin === 'string') {
    binRel = pkg.bin;
  } else if (pkg.bin && typeof pkg.bin === 'object') {
    const first = Object.keys(pkg.bin)[0];
    if (!first) {
      console.error('[make-executable] failed: package.json has empty "bin" object');
      process.exit(1);
    }
    binRel = pkg.bin[first];
  } else {
    console.error('[make-executable] failed: package.json has no "bin" field');
    process.exit(1);
  }

  const binAbs = resolve(pkgDir, binRel);
  if (!(await pathExists(binAbs))) {
    console.error(`[make-executable] failed: Not found: ${binAbs}`);
    console.error('  Hints: check tsconfig.build include/rootDir/outDir and that "bin" points to the emitted JS');
    process.exit(1);
  }

  let content = await fsp.readFile(binAbs, 'utf8');
  if (!content.startsWith('#!/usr/bin/env node')) {
    content = '#!/usr/bin/env node\n' + content;
    await fsp.writeFile(binAbs, content, 'utf8');
  }
  await fsp.chmod(binAbs, 0o755);
  console.log(`[make-executable] OK: ${binAbs}`);
}

main().catch((e) => {
  console.error('[make-executable] unexpected error:', e?.stack || e?.message || e);
  process.exit(1);
});
