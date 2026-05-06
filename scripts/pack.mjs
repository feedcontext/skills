import {cp, mkdir, rm} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "skills/feedcontext");
const outputScripts = resolve(output, "scripts");

await rm(output, {force: true, recursive: true});
await mkdir(outputScripts, {recursive: true});
await cp(resolve(root, "skill"), output, {recursive: true});

const result = await Bun.build({
  entrypoints: [resolve(root, "src/feedcontext.ts")],
  format: "esm",
  outdir: outputScripts,
  packages: "bundle",
  target: "node",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await cp(resolve(outputScripts, "feedcontext.js"), resolve(outputScripts, "helper.mjs"));
await rm(resolve(outputScripts, "feedcontext.js"));
