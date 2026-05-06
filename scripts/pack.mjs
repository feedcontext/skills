import {cp, mkdir, rm} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, {force: true, recursive: true});
await mkdir(dist, {recursive: true});

const result = await Bun.build({
  entrypoints: [resolve(root, "src/feedcontext.ts")],
  format: "esm",
  outdir: dist,
  packages: "bundle",
  target: "node",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await cp(resolve(dist, "feedcontext.js"), resolve(dist, "feedcontext.mjs"));
await rm(resolve(dist, "feedcontext.js"));
