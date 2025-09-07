#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_DIR = path.resolve(__dirname, '..');

const pkgJsonPath = path.join(PKG_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

// Resolve bin entry
let binRel;
if (typeof pkg.bin === 'string') {
  binRel = pkg.bin;
} else if (pkg.bin && typeof pkg.bin === 'object') {
  const first = Object.values(pkg.bin)[0];
  if (!first) {
    console.error('make-executable: package.json "bin" is empty');
    process.exit(1);
  }
  binRel = first;
} else {
  console.error('make-executable: package.json has no "bin" field');
  process.exit(1);
}

const entry = path.resolve(PKG_DIR, binRel);
if (!fs.existsSync(entry)) {
  console.error(`make-executable: dist entry not found: ${entry}`);
  process.exit(1);
}

// Prepend shebang if missing
const content = fs.readFileSync(entry, 'utf8');
const SHEBANG = '#!/usr/bin/env node\n';
if (!content.startsWith(SHEBANG)) {
  fs.writeFileSync(entry, SHEBANG + content);
  console.log(`Shebang added to ${entry}`);
} else {
  console.log(`Shebang already present in ${entry}`);
}

// chmod +x
const st = fs.statSync(entry);
const mode = st.mode | 0o111;
fs.chmodSync(entry, mode);
console.log(`Set executable bit on ${entry}`);
console.log('make-executable: done.');
