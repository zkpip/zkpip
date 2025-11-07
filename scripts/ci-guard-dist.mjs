// scripts/ci-guard-dist.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST_ROOT = join(ROOT, 'packages/cli/dist');

if (!existsSync(DIST_ROOT)) {
  console.log('No dist directory found for @zkpip/cli, skipping guard.');
  process.exit(0);
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }

  return files;
}

const candidates = walk(DIST_ROOT).filter((file) =>
  file.endsWith('.js') || file.endsWith('.d.ts')
);

const badLines = [];

for (const file of candidates) {
  const rel = file.slice(ROOT.length + 1);
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const matchIdx = line.indexOf('../src/');
    if (matchIdx === -1) {
      return;
    }

    const trimmed = line.trimStart();

    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return;
    }

    const lineCommentIdx = line.indexOf('//');
    const blockCommentIdx = line.indexOf('/*');

    const commentBefore =
      (lineCommentIdx !== -1 && lineCommentIdx < matchIdx) ||
      (blockCommentIdx !== -1 && blockCommentIdx < matchIdx);

    if (commentBefore) {
      return;
    }

    badLines.push(`${rel}:${idx + 1}:${line}`);
  });
}

if (badLines.length > 0) {
  console.error('ERROR: Found ../src/ runtime references in dist:');
  for (const l of badLines) {
    console.error(l);
  }
  process.exit(1);
}

console.log('OK: no ../src/ runtime imports in dist artifacts.');
process.exit(0);
