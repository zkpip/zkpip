// packages/cli/src/utils/vectorStore.ts
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';

export interface VectorStore {
  // keep literal type for strong contract
  putVector(id: string, content: string, contentType: 'application/json'): Promise<void>;
  getVector(id: string): Promise<string | null>;
}

export class DiskStore implements VectorStore {
  constructor(private readonly baseDir: string) {}

  // NOTE: include the 3rd param with the exact literal type to satisfy the interface
  async putVector(id: string, content: string, contentType: 'application/json'): Promise<void> {    
    // contentType is enforced by the interface; we don't need it at runtime yet
    void contentType;
    const safeId = id.replace(/[^a-zA-Z0-9:._-]/g, '_');
    await fsp.mkdir(this.baseDir, { recursive: true });
    await fsp.writeFile(join(this.baseDir, `${safeId}.json`), content, 'utf8');
  }

  async getVector(id: string): Promise<string | null> {
    const fname = `${id.replace(/[^a-zA-Z0-9:._-]/g, '_')}.json`;
    const p = join(this.baseDir, fname);
    try {
      return await fsp.readFile(p, 'utf8');
    } catch {
      return null;
    }
  }
}
