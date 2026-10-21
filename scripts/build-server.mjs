import { build } from "esbuild";

await build({
  entryPoints: { server: "server/index.ts", "create-curator": "server/create-curator.ts" },
  outdir: "build",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: true,
});
