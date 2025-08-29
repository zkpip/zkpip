// scripts/copy-schemas.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  const coreRoot = path.resolve(__dirname, "..");
  const src = path.join(coreRoot, "schemas");
  const dest = path.join(coreRoot, "dist/schemas");
  copyDirSync(src, dest);
  console.log(`✅ Schemas copied: ${src} -> ${dest}`);
}

main();
