// packages/cli/src/commands/vectors-pull.ts
// POC pull: data: URL → fájlba. (Később jöhet HTTP is.)
// ESM, strict TS, no `any`.

import { writeFile } from 'node:fs/promises';

export interface VectorsPullArgs {
  id?: string;   // future: registry lookup by URN
  url?: string;  // direct content (POC: data: URL)
  out: string;   // output file path
}

export async function runVectorsPull(args: VectorsPullArgs): Promise<number> {
  const { id, url, out } = args;

  if ((!id && !url) || !out) {
    console.error(JSON.stringify({ ok: false, code: 'MISSING_ARGS', message: 'Need --url (or --id) and --out' }));
    return 1;
  }

  // POC: handle only data: URLs
  if (!url || !url.startsWith('data:')) {
    console.error(JSON.stringify({ ok: false, code: 'UNSUPPORTED_URL', message: 'Only data: URLs supported in POC' }));
    return 1;
  }

  const comma = url.indexOf(',');
  if (comma < 0) {
    console.error(JSON.stringify({ ok: false, code: 'BAD_DATA_URL', message: 'Invalid data: URL' }));
    return 1;
  }

  const meta = url.slice(5, comma);   // "data:<meta>"
  const payload = url.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);

  const buf = isBase64 ? Buffer.from(payload, 'base64')
                       : Buffer.from(decodeURIComponent(payload), 'utf8');

  await writeFile(out, buf);
  console.log(JSON.stringify({ ok: true, out }));
  return 0;
}
