// Global ambient shims for subpath imports used across the monorepo.
// IMPORTANT: no relative imports here.

declare module '#fs-compat' {
  import type { WriteFileOptions as NodeWriteFileOptions, MakeDirectoryOptions } from 'node:fs';

  export function writeFile(file: string, data: string | Uint8Array, options?: NodeWriteFileOptions): Promise<void>;
  export function writeFileSync(file: string, data: string | Uint8Array, options?: NodeWriteFileOptions): void;

  // Async mkdir wrapper (fs/promises) + sync variant
  export function mkdir(path: string, options?: MakeDirectoryOptions): Promise<void>;
  export function mkdir(path: string, options: number): Promise<void>;
  export function mkdirSync(path: string, options?: unknown): string | undefined;

  export function writeJson(file: string, value: unknown, pretty?: boolean | number): void;

  export type WriteFileOptions = NodeWriteFileOptions;

  const _default: {
    writeFile: typeof writeFile;
    writeFileSync: typeof writeFileSync;
    mkdir: typeof mkdir;
    mkdirSync: typeof mkdirSync;
    writeJson: typeof writeJson;
  };
  export default _default;
}

declare module '#paths' {
  // Csak a legszükségesebb felületek, bővíthető később
  export function fromHere(...p: string[]): string;
  export function projectRoot(): string;
  export function repoJoin(...p: string[]): string | undefined;
}
