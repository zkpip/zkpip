// Ambient type shim for "#fs-compat" so the IDE/TS server stops complaining.
// IMPORTANT: no relative imports inside ambient modules!

declare module '#fs-compat' {
  import type { WriteFileOptions as NodeWriteFileOptions, MakeDirectoryOptions, mkdirSync } from 'node:fs';

  // Overloaded signatures (match fs-compat)
  export function mkdir(path: string, options?: MakeDirectoryOptions): Promise<void>;
  export function mkdir(path: string, options: number): Promise<void>;

  export function writeFile(file: string, data: string | Uint8Array, options?: NodeWriteFileOptions): Promise<void>;
  export function writeFileSync(file: string, data: string | Uint8Array, options?: NodeWriteFileOptions): void;
  export function writeJson(file: string, value: unknown, pretty?: boolean | number): void;

  // Re-exported type alias (keeps call sites happy)
  export type WriteFileOptions = NodeWriteFileOptions;

  // Default export to support: `import fs from '#fs-compat'`
  const _default: {
    writeFile: typeof writeFile;
    mkdir: typeof mkdir;
    writeFileSync: typeof writeFileSync;
    mkdirSync: typeof mkdirSync;
    writeJson: typeof writeJson;
  };
  export default _default;
}
