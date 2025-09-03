import { chmodSync, readFileSync, writeFileSync } from "node:fs";
const p = new URL("../dist/index.js", import.meta.url);
const file = new URL(p).pathname;
let src = readFileSync(file, "utf8");
if (!src.startsWith("#!/usr/bin/env node")) {
  src = "#!/usr/bin/env node\n" + src;
  writeFileSync(file, src);
}
chmodSync(file, 0o755);
