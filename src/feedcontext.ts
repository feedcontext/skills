#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { assembleAudioBrief } from "./helper/audio-assemble";
import { writeAudioRenderManifest } from "./helper/audio-render";
import { writeAudioSegments } from "./helper/audio-segments";
import { reviewAudioBrief } from "./helper/audio-review";
import { renderBriefingPage } from "./helper/render-page";
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

  const artifact = program.command("artifact").description("Render local artifact files");
  artifact
    .command("render-page")
    .description("Render a complete local Briefing Page from Structured Synthesis")
    .requiredOption("--synthesis-file <path>", "Structured Synthesis JSON file")
    .requiredOption("--out <path>", "Output HTML file path")
    .action((options) =>
      renderBriefingPage({
        out: options.out,
        synthesisFile: options.synthesisFile,
      }),
    );

  const audio = program.command("audio").description("Prepare local Audio Brief artifacts");
  audio
    .command("segments")
    .description("Create a resumable segment manifest from a Show Script")
    .requiredOption("--script-file <path>", "Show Script JSON file")
    .requiredOption("--out <path>", "Output segment manifest JSON file")
    .action((options) =>
      writeAudioSegments({
        out: options.out,
        scriptFile: options.scriptFile,
      }),
    );
  audio
    .command("render")
    .description("Write a resumable render manifest for provider segment files")
    .requiredOption("--segments-file <path>", "Audio segment manifest JSON file")
    .requiredOption("--segment-dir <path>", "Directory containing provider-rendered segment files")
    .requiredOption("--manifest-out <path>", "Output render manifest JSON file")
    .option("--retry-out <path>", "Output retry queue JSON file for missing or empty segments")
    .option("--resume", "Reuse valid existing segment files")
    .action((options) =>
      writeAudioRenderManifest({
        manifestOut: options.manifestOut,
        resume: Boolean(options.resume),
        retryOut: options.retryOut,
        segmentDir: options.segmentDir,
        segmentsFile: options.segmentsFile,
      }),
    );
  audio
    .command("assemble")
    .description("Assemble reusable provider segment files into a final local Audio Brief")
    .requiredOption("--render-manifest <path>", "Ready audio render manifest JSON file")
    .requiredOption("--out <path>", "Final output audio file path")
    .requiredOption("--manifest-out <path>", "Output assembly manifest JSON file")
    .option("--intro-audio <path>", "Intro audio file to prepend")
    .option("--outro-audio <path>", "Outro audio file to append")
    .option("--no-default-music", "Do not include default intro or outro audio")
    .option("--ffmpeg-bin <path>", "ffmpeg executable path")
    .action((options) =>
      assembleAudioBrief({
        ffmpegBin: options.ffmpegBin,
        introAudio: options.introAudio,
        manifestOut: options.manifestOut,
        noDefaultMusic: options.defaultMusic === false,
        out: options.out,
        outroAudio: options.outroAudio,
        renderManifest: options.renderManifest,
      }),
    );
  audio
    .command("review")
    .description("Review and optionally repair final Audio Brief metadata")
    .requiredOption("--file <path>", "Final M4A audio file path")
    .requiredOption("--assembly-manifest <path>", "Audio assembly manifest JSON file")
    .requiredOption("--out <path>", "Output review manifest JSON file")
    .option("--no-repair", "Only report review status; do not repair metadata")
    .option("--ffprobe-bin <path>", "ffprobe executable path")
    .option("--ffmpeg-bin <path>", "ffmpeg executable path")
    .action((options) =>
      reviewAudioBrief({
        assemblyManifest: options.assemblyManifest,
        ffmpegBin: options.ffmpegBin,
        ffprobeBin: options.ffprobeBin,
        file: options.file,
        noRepair: options.repair === false,
        out: options.out,
      }),
    );

  await program.parseAsync(argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
