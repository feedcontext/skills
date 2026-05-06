import {cp, mkdir, rm} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputScripts = resolve(root, "skills/feedcontext/scripts");

await mkdir(outputScripts, {recursive: true});

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

await rm(resolve(outputScripts, "helper.mjs"), {force: true});
await cp(resolve(outputScripts, "feedcontext.js"), resolve(outputScripts, "helper.mjs"));
await rm(resolve(outputScripts, "feedcontext.js"));
