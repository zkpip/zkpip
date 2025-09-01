import * as fs from "node:fs";
import * as path from "node:path";

/** List directory entries if it exists; otherwise empty. */
export const list = (dir: string): string[] =>
  fs.existsSync(dir) ? fs.readdirSync(dir) : [];

/** Keep only *.json files (case-insensitive). */
export const onlyJson = (files: string[]): string[] =>
  files.filter((f) => f.toLowerCase().endsWith(".json"));

/** Return JSON files that do NOT end with .valid.json or .invalid.json */
export function offendingFilesWithoutValidInvalidSuffix(dir: string): string[] {
  const files = onlyJson(list(dir));
  return files.filter((f) => !/\.valid\.json$|\.invalid\.json$/i.test(f));
}

/** Detect self-nested folder like <root>/<name>/<name>. */
export function selfNestedOffenders(root: string): string[] {
  const offenders: string[] = [];
  for (const name of list(root)) {
    const child = path.join(root, name);
    if (!fs.existsSync(child) || !fs.statSync(child).isDirectory()) continue;
    const nested = path.join(child, path.basename(child));
    if (fs.existsSync(nested)) offenders.push(nested);
  }
  return offenders;
}
