// Small shared helpers for E2E (no `any`; English comments)
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';

export async function sha256File(fp: string): Promise<string> {
  const h = createHash('sha256');
  const s = await fs.readFile(fp);
  h.update(s);
  return h.digest('hex');
}

export type ReadJsonOk<T> = { readonly ok: true; readonly data: T };
export type ReadJsonErr = { readonly ok: false; readonly err: string };

export async function readJsonSafe<T>(fp: string): Promise<ReadJsonOk<T> | ReadJsonErr> {
  try {
    const raw = await fs.readFile(fp, 'utf8');
    return { ok: true, data: JSON.parse(raw) as T };
  } catch (e: unknown) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

export async function writeJson(fp: string, data: unknown): Promise<void> {
  await fs.writeFile(fp, JSON.stringify(data, null, 2));
}
