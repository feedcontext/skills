#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { getVersionStatus } from "./helper/version";

export { buildVersionStatus, getVersionStatus } from "./helper/version";

async function printVersionStatus() {
  console.log(JSON.stringify(await getVersionStatus()));
}

async function main(argv = process.argv) {
  const program = new Command();
  program.name("feedcontext").description("FeedContext Skill local helper");

  program
    .command("version")
    .description("Print installed revision, latest revision, and upgrade status")
    .action(printVersionStatus);

  await program.parseAsync(argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
