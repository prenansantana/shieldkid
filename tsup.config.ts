import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/sdk/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "ShieldKid",
  dts: true,
  minify: true,
  clean: true,
  outDir: "dist/sdk",
});
