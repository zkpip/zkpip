// ESM script – regenerate all *.json → *.sealed.json as Seal V1 (kind=vector)
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaNode } from 'execa';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..'); // packages/cli
const distCli = path.join(repo, 'dist', 'index.js');

// Adjust these roots to where your fixtures live:
const roots = [
  path.join(repo, 'src', '__tests__', 'fixtures'),
  // add more folders if needed
];

async function regen(dir: string) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await regen(p);
    } else if (e.isFile() && e.name.endsWith('.json') && !e.name.endsWith('.sealed.json')) {
      const out = p.replace(/\.json$/, '.sealed.json');
      mkdirSync(path.dirname(out), { recursive: true });
      await execaNode(distCli, ['vectors', 'sign', '--in', p, '--out', out, '--key-dir', path.join(dir, '.keys')], {
        stdio: 'pipe',
        env: { ZKPIP_HARD_EXIT: '0' }
      });
      // sanity
      const sealed = JSON.parse(readFileSync(out, 'utf8'));
      if (!sealed?.seal?.urn?.startsWith('urn:zkpip:vector:sha256:')) {
        throw new Error(`Unexpected URN in ${out}`);
      }
      console.log('OK:', out);
    }
  }
}

(async () => {
  for (const r of roots) {
    try { await regen(r); } catch (e) { console.error('FAIL in', r, e); process.exit(1); }
  }
})();
