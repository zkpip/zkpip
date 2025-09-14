import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { VectorId, VectorManifestV1, VectorProvider, ResolvedVector } from './canvectors.types.js';

const CACHE_DIR = process.env.CANVECTORS_CACHE_DIR ?? '.cache/canvectors';

export class HttpProvider implements VectorProvider {
  // If `CANVECTORS_ONLINE` is not set, try cache only.
  private readonly online: boolean = process.env.CANVECTORS_ONLINE === '1';

  async resolve(input: VectorId | VectorManifestV1): Promise<ResolvedVector> {
    const manifest = typeof input === 'string' ? await this.fetchManifestById(input) : input;

    const { urls, sha256 } = manifest;
    const expectedHash = sha256?.verification; // optional expected SHA256
    const cachePath = join(CACHE_DIR, manifest.id.replaceAll(':', '/'), 'verification.json');

    let text: string | undefined;

    // 1) try cache first
    try {
      text = await readFile(cachePath, 'utf8');
    } catch {
      // no cache
    }

    // 2) If online and we either have no cache or the cache hash mismatches → fetch fresh
    const cacheHashMismatch =
      typeof expectedHash === 'string' &&
      typeof text === 'string' &&
      createHash('sha256').update(text).digest('hex') !== expectedHash;

    if (this.online && (!text || cacheHashMismatch)) {
      const r = await fetch(urls.verification, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${urls.verification}`);
      const fetched = await r.text();

      if (typeof expectedHash === 'string') {
        const got = createHash('sha256').update(fetched).digest('hex');
        if (got !== expectedHash) {
          throw new Error(`SHA256 mismatch for ${manifest.id}`);
        }
      }

      await mkdir(cachePath.slice(0, cachePath.lastIndexOf('/')), { recursive: true });
      await writeFile(cachePath, fetched, 'utf8');
      text = fetched;
    }

    // 3) Final guard: we must have text at this point (cache or fetched)
    if (typeof text !== 'string') {
      throw new Error(`Offline and no cache for ${manifest.id}`);
    }

    return {
      id: manifest.id,
      verificationJson: JSON.parse(text) as unknown,
      manifest,
    };
  }

  private async fetchManifestById(id: VectorId): Promise<VectorManifestV1> {
    const base = process.env.CANVECTORS_BASE ?? 'https://canvectors.zkpip.org/v1';
    const url = `${base}/${id.replaceAll(':', '/')}/manifest.json`;
    if (!this.online) throw new Error(`Offline mode: cannot fetch manifest ${url}`);
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return (await r.json()) as VectorManifestV1;
  }
}
