#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { getVersionStatus } from "./helper/version";
import {
  printShowScriptSchema,
  printSynthesisSchema,
  validateShowScriptFile,
  validateSynthesisFile,
} from "./helper/validation";

export { buildVersionStatus, getVersionStatus } from "./helper/version";
export { validateShowScript, validateStructuredSynthesis } from "./helper/validation";

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

  const synthesis = program.command("synthesis").description("Validate Structured Synthesis files");
  synthesis
    .command("validate")
    .description("Validate a Structured Synthesis JSON file")
    .requiredOption("--file <path>", "Structured Synthesis JSON file to validate")
    .action((options) => validateSynthesisFile(options.file));
  synthesis
    .command("schema")
    .description("Print the FeedContext Structured Synthesis JSON Schema")
    .action(printSynthesisSchema);

  const showScript = program.command("show-script").description("Validate Show Script files");
  showScript
    .command("validate")
    .description("Validate a Show Script JSON file")
    .requiredOption("--file <path>", "Show Script JSON file to validate")
    .action((options) => validateShowScriptFile(options.file));
  showScript
    .command("schema")
    .description("Print the FeedContext Show Script JSON Schema")
    .action(printShowScriptSchema);

  await program.parseAsync(argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
