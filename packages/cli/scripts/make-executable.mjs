#!/usr/bin/env node
import { access, readFile, writeFile, chmod } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { fileURLToPath } from 'node:url';

const distEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

async function main() {
  try {
    await access(distEntry, FS.F_OK);
  } catch {
    console.error(`make-executable: dist entry not found: ${distEntry}`);
    process.exit(1);
  }

  const content = await readFile(distEntry, 'utf8');

  if (!content.startsWith('#!')) {
    await writeFile(distEntry, `#!/usr/bin/env node\n${content}`, 'utf8');
    console.log(`Shebang added to ${distEntry}`);
  } else {
    console.log(`Shebang already present in ${distEntry}`);
  }

  await chmod(distEntry, 0o755);
  console.log(`Set executable bit on ${distEntry}`);
  console.log('make-executable: done.');
}

main().catch((err) => {
  console.error('make-executable: failed:', err?.stack ?? String(err));
  process.exit(1);
});
