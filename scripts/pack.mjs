import {cp, mkdir, rm} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "skills/feedcontext");
const outputDist = resolve(output, "dist");

await rm(output, {force: true, recursive: true});
await mkdir(outputDist, {recursive: true});
await cp(resolve(root, "skill"), output, {recursive: true});

const result = await Bun.build({
  entrypoints: [resolve(root, "src/feedcontext.ts")],
  format: "esm",
  outdir: outputDist,
  packages: "bundle",
  target: "node",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await cp(resolve(outputDist, "feedcontext.js"), resolve(outputDist, "feedcontext.mjs"));
await rm(resolve(outputDist, "feedcontext.js"));
