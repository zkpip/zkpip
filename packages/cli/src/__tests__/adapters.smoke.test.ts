import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI = path.resolve(__dirname, "..", "dist", "index.js");

function run(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

describe("adapters --json smoke", () => {
  it("prints a non-empty adapter list with id/proofSystem/framework", () => {
    const r = run(["adapters", "--json"]);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout || "{}");
    expect(out.ok).toBe(true);
    expect(Array.isArray(out.adapters)).toBe(true);
    expect(out.adapters.length).toBeGreaterThan(0);
    const first = out.adapters[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("proofSystem");
    expect(first).toHaveProperty("framework");
  });
});
