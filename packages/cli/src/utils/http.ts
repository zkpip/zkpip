// Safe fetchers with size limit and timeout; http disabled unless explicitly allowed.
import { createWriteStream, promises as fs } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

export interface PullOptions {
  url: string;
  outDir: string;
  allowHttp: boolean;
  maxBytes: number; // e.g. 5 * 1024 * 1024
  readTimeoutMs: number; // e.g. 15000
}

export function assertSafeFileUrl(fileUrl: string): string {
  // Allow only absolute paths; prevent traversal
  if (!fileUrl.startsWith('file://')) {
    throw new Error('Not a file:// URL');
  }
  const abs = fileUrl.replace('file://', '');
  const resolved = resolve(abs);
  if (!resolved.startsWith(sep)) {
    throw new Error('Only absolute file paths allowed');
  }
  return resolved;
}

export async function fetchToDisk(opts: PullOptions): Promise<string> {
  const { url, outDir, allowHttp, maxBytes, readTimeoutMs } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeoutMs);

  try {
    if (url.startsWith('data:')) {
      // data:...;base64,
      const idx = url.indexOf('base64,');
      if (idx === -1) throw new Error('Unsupported data URL (expect base64)');
      const base64 = url.slice(idx + 'base64,'.length);
      const buf = Buffer.from(base64, 'base64');
      if (buf.byteLength > maxBytes) throw new Error('Payload exceeds size limit');
      const out = resolve(outDir, `data-${Date.now()}.json`);
      await fs.writeFile(out, buf);
      return out;
    }

    if (url.startsWith('file://')) {
      const filePath = assertSafeFileUrl(url);
      const stat = await fs.stat(filePath);
      if (stat.size > maxBytes) throw new Error('File exceeds size limit');
      const out = resolve(outDir, basename(filePath));
      await fs.copyFile(filePath, out);
      return out;
    }

    if (/^https?:\/\//i.test(url)) {
    if (!allowHttp && url.startsWith('http://')) {
        throw new Error('Plain HTTP is blocked; pass --allow-http to enable');
    }

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const out = resolve(outDir, basename(new URL(url).pathname) || `remote-${Date.now()}.json`);
    const fileStream = createWriteStream(out, { flags: 'w' });

    // Convert WHATWG ReadableStream -> Node.js Readable
    const nodeReadable = Readable.fromWeb(res.body as unknown as ReadableStream);

    // Byte-counting Transform to enforce size limit
    let read = 0;
    class SizeLimit extends Transform {
        // We ignore 'encoding' entirely, so keep it a generic string/unknown
        _transform(
            chunk: Buffer,
            _enc: string, // or: unknown
            cb: (err?: Error | null, data?: Buffer) => void
        ) {
            read += chunk.byteLength;
            if (read > maxBytes) cb(new Error('Download exceeds size limit'));
            else cb(null, chunk);
        }
    }

    // Pipe: HTTP response -> size limiter -> file
    await pipeline(nodeReadable, new SizeLimit(), fileStream);

    return out;
    }

    throw new Error('Unsupported URL scheme');
  } finally {
    clearTimeout(timeout);
    // a tiny delay to ensure stream close on some Node versions
    await delay(0);
  }
}
