declare module '../utils/fs-compat.js' {
  export function writeFile(
    filePath: string,
    contents: string | Uint8Array
  ): Promise<void>;
}
