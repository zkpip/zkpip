import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Optional but helps when running Vitest directly from this package
    root: __dirname,
  },
  resolve: {
    conditions: ["import", "node"], // prefer ESM entry
    alias: {
      // Force @zkpip/core to resolve to the built dist entry
      "@zkpip/core": path.resolve(__dirname, "../core/dist/index.js"),
    },
  },
  server: {
    fs: {
      // Allow Vitest dev server to read outside this package root
      allow: [
        __dirname,
        path.resolve(__dirname, "../core/dist"),
        path.resolve(__dirname, "..", ".."), // workspace root
      ],
    },
  },
});
