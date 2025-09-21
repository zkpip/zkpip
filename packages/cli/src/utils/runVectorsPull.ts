// packages/cli/src/utils/runVectorsPull.ts
// MVP: resolve URL (from --url or simplistic id->URL mapping), GET and save.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { VectorsPullArgs } from '../commands/vectors-pull.js';

// Simple resolver placeholder: replace with AWS registry lookup later
function resolveUrlFromId(id: string): string {
  // POC rule: last sha256 segment → build static URL pattern
  const m = id.match(/urn:zkpip:vector:sha256:([a-f0-9]{6,})$/i);
  if (!m) throw new Error(`Unrecognized vector id format: ${id}`);
  const hash = m[1];
  // TODO: swap to AWS API endpoint later
  return `https://cdn.example.com/zkpip/canvectors/sha256/${hash}/proof-envelope.json`;
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function runVectorsPull(args: VectorsPullArgs): Promise<number> {
  const url = args.url ?? (args.id ? resolveUrlFromId(args.id) : undefined);
  if (!url) throw new Error('Missing URL and could not resolve from id');
  const data = await download(url);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, data);
  return 0;
}
