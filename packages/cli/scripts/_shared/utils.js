// Small shared helpers for E2E (no `any`; English comments)
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { writeFile } from '#fs-compat';
export async function sha256File(fp) {
    const h = createHash('sha256');
    const s = await fs.readFile(fp);
    h.update(s);
    return h.digest('hex');
}
export async function readJsonSafe(fp) {
    try {
        const raw = await fs.readFile(fp, 'utf8');
        return { ok: true, data: JSON.parse(raw) };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e) };
    }
}
export async function writeJson(fp, data) {
    await writeFile(fp, JSON.stringify(data, null, 2));
}
//# sourceMappingURL=utils.js.map