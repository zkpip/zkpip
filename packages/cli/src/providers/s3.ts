export interface VectorProvider {
  putVector(id: string, body: string, contentType: string): Promise<void>;
  getVector(id: string): Promise<string>;
}

export class DiskProvider implements VectorProvider {
  constructor(private baseDir: string) {}
  async putVector(id: string, body: string, contentType: string): Promise<void> {
    void contentType; // marks as intentionally unused for linter
    await (await import('node:fs/promises')).mkdir(this.baseDir, { recursive: true });
    const safe = id.replace(/[:/]/g, '_');
    await (await import('node:fs/promises')).writeFile(`${this.baseDir}/${safe}.json`, body, 'utf8');
  }
  async getVector(id: string): Promise<string> {
    const safe = id.replace(/[:/]/g, '_');
    return (await import('node:fs/promises')).readFile(`${this.baseDir}/${safe}.json`, 'utf8');
  }
}
