// packages/cli/scripts/make-executable.cjs
// Ensure dist/index.js is executable and has a proper shebang.
// Works on Windows/macOS/Linux. Safe to run multiple times.

const fs = require('fs');
const path = require('path');

const ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');
const SHEBANG = '#!/usr/bin/env node\n';

function ensureFileExists(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Entry file not found: ${p}. Did you run "tsc -b" successfully?`);
  }
}

function ensureShebang(p) {
  const buf = fs.readFileSync(p);
  const hasShebang = buf.slice(0, SHEBANG.length).toString() === SHEBANG;
  if (!hasShebang) {
    const content = buf.toString();
    fs.writeFileSync(p, SHEBANG + content, { encoding: 'utf8' });
    console.log(`Prepended shebang to ${p}`);
  } else {
    console.log(`Shebang already present in ${p}`);
  }
}

function ensureExecutable(p) {
  try {
    // 0o755 => -rwxr-xr-x
    fs.chmodSync(p, 0o755);
    console.log(`Set executable bit on ${p}`);
  } catch (e) {
    // On Windows this may be a no-op; that's fine.
    console.warn(`chmod skipped or failed on ${p}: ${e.message}`);
  }
}

(function main() {
  ensureFileExists(ENTRY);
  ensureShebang(ENTRY);
  ensureExecutable(ENTRY);
  console.log('make-executable: done.');
})();
