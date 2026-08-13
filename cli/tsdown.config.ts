import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  clean: true,
  deps: { neverBundle: ["typebox"] },
  format: ["esm"],
  platform: "node",
  publint: true,
  target: "node24",
});
