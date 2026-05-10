#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { getSession, login, logout } from "./helper/auth";
import { apiCall } from "./helper/api";
import { buildGetItemPath, buildListItemsPath, getManyItemsCommand, listAllItems, writeGatherInsightFile } from "./helper/items";
import { importOpml } from "./helper/subscriptions";
import { getVersionStatus } from "./helper/version";
import { printAudioProviderDoctor, renderAudio, writeAudioSegmentsFromShowScript } from "./helper/audio";
import { printShowScriptSchema, printSynthesisSchema, validateShowScriptFile, validateSynthesisFile } from "./helper/validation";
import { deliverArtifactCommand } from "./helper/artifacts";
import { disconnectTelegram, printTelegramBindingLink, printTelegramStatus } from "./helper/integrations";

export { API_ORIGIN, AUTH_BASE, CLIENT_ID, REDIRECT_URI, SCOPES, SKILL_PAIR_ENDPOINT, WEB_ORIGIN } from "./helper/config";
export type { GatherInsightResult, SkillSession, VersionStatus } from "./helper/types";
export { createSkillAuthUrl, parsePairCode } from "./helper/auth";
export { enforceConfirmBeforeNetwork, isAllowedRawCall, isMutatingRawCall } from "./helper/api";
export { buildGetItemPath, buildListItemsPath, gatherInsight, getManyItems, writeGatherInsightFile } from "./helper/items";
export { parseOpmlFeedUrls } from "./helper/subscriptions";
export { buildVersionStatus, getVersionStatus } from "./helper/version";
export { buildAudioSegmentsFromShowScript, detectAudioProviders, renderBingEdgeTts, renderBingEdgeTtsSegments } from "./helper/audio";
export { deliverArtifact, inferArtifactContentType } from "./helper/artifacts";
export { disconnectTelegram, printTelegramBindingLink, printTelegramStatus } from "./helper/integrations";
export { normalizeItemIds, parseConcurrency, parseItemIdsFile, parsePositiveIntegerOption, runWithConcurrency } from "./helper/utils";
export { validateShowScript, validateStructuredSynthesis } from "./helper/validation";

async function printVersionStatus() {
  console.log(JSON.stringify(await getVersionStatus()));
}

async function main(argv = process.argv) {
  const program = new Command();
  program.name("feedcontext").description("FeedContext Skill helper");

  program
    .command("version")
    .description("Print installed revision, latest revision, and upgrade status")
    .action(printVersionStatus);
  program
    .command("login")
    .description("Start browser login or finish login with a pair code")
    .option("--pair-code <code>", "Resolve a pending browser login with the 6-digit pair code")
    .action((options) => login({ pairCode: options.pairCode }));
  program
    .command("logout")
    .description("Clear the local Skill Session and pending login state")
    .action(logout);
  program
    .command("raw")
    .description("Call an allowlisted public API path directly")
    .requiredOption("--method <method>", "HTTP method for the allowlisted API request")
    .requiredOption("--path <path>", "Allowlisted API path, including query string when needed")
    .option("--body <json>", "JSON request body for allowlisted write requests")
    .option("--confirm", "Confirm host approval for a mutating request before network access")
    .action((options) =>
      apiCall({
        body: options.body ? JSON.parse(options.body) : undefined,
        confirm: options.confirm,
        method: options.method,
        path: options.path,
      }),
    );

  const subscription = program.command("subscription").description("Read and manage Subscriptions");
  subscription
    .command("list")
    .description("List all visible Subscriptions")
    .action(() => apiCall({ method: "GET", path: "/v1/subscriptions" }));
  subscription
    .command("add")
    .description("Create a Subscription from an RSS or Atom feed URL")
    .requiredOption("--feed-url <url>", "RSS or Atom feed URL to subscribe to")
    .option("--confirm", "Confirm host approval before creating the Subscription")
    .action((options) =>
      apiCall({
        body: { feed_url: options.feedUrl },
        confirm: options.confirm,
        method: "POST",
        path: "/v1/subscriptions",
      }),
    );
  subscription
    .command("import-opml")
    .description("Import Subscriptions from an OPML file")
    .requiredOption("--file <path>", "OPML file to parse for RSS or Atom feed URLs")
    .option("--concurrency <count>", "Number of concurrent subscription creates", "32")
    .option("--confirm", "Confirm host approval before creating Subscriptions")
    .action((options) =>
      importOpml({
        concurrency: options.concurrency,
        confirm: options.confirm,
        file: options.file,
      }),
    );
  subscription
    .command("delete")
    .description("Delete a Subscription by id")
    .requiredOption("--id <id>", "Subscription id to delete")
    .option("--confirm", "Confirm host approval before deleting the Subscription")
    .action((options) =>
      apiCall({
        confirm: options.confirm,
        method: "DELETE",
        path: `/v1/subscriptions/${options.id}`,
      }),
    );

  const item = program.command("item").description("Discover and read Feed Items");
  item
    .command("list")
    .description("List Feed Item discovery metadata")
    .option("--subscription-id <id>", "Filter Feed Items to one Subscription id")
    .option("--keyword <text>", "Search Feed Item discovery metadata")
    .option("--published-after <timestamp>", "Only include Feed Items published after this epoch millisecond timestamp")
    .option("--published-before <timestamp>", "Only include Feed Items published before this epoch millisecond timestamp")
    .option("--limit <count>", "Page size for Feed Item listing, up to 100")
    .option("--cursor <cursor>", "Opaque list pagination cursor to continue from")
    .option("--id <id>", "Filter to a Feed Item id; repeatable", (value, previous: string[]) => [
      ...(previous ?? []),
      value,
    ])
    .option("--search-content", "Search Feed Item content as well as discovery metadata")
    .option("--all", "Follow pagination and return all matching Feed Items")
    .option("--max-pages <count>", "Safety cap for --all pagination", "1000")
    .action((options) => {
      if (options.all) {
        return listAllItems({ ...options, ids: options.id });
      }

      return apiCall({
        method: "GET",
        path: buildListItemsPath({ ...options, ids: options.id }),
      });
    });
  item
    .command("get")
    .description("Read one Feed Item content chunk")
    .requiredOption("--id <id>", "Feed Item id to read")
    .option("--cursor <cursor>", "Content continuation cursor")
    .option("--max-chars <count>", "Maximum content characters to read")
    .option("--include-raw", "Include raw content and Feed Item metadata for debugging or recovery")
    .action((options) => apiCall({ method: "GET", path: buildGetItemPath(options) }));
  item
    .command("get-many")
    .description("Read multiple Feed Item content chunks with bounded local concurrency")
    .option("--id <id>", "Feed Item id to read; repeatable", (value, previous: string[]) => [
      ...(previous ?? []),
      value,
    ])
    .option("--ids-file <path>", "File containing Feed Item ids as a JSON array or newline-delimited text")
    .option("--concurrency <count>", "Number of concurrent Feed Item reads", "8")
    .option("--max-chars <count>", "Maximum content characters to read per Feed Item")
    .option("--include-raw", "Include raw content and Feed Item metadata for debugging or recovery")
    .action((options) =>
      getManyItemsCommand({
        concurrency: options.concurrency,
        ids: options.id,
        idsFile: options.idsFile,
        includeRaw: options.includeRaw,
        maxChars: options.maxChars,
      }),
    );

  const insight = program.command("insight").description("Compose Feed Item aggregation sidecars");
  insight
    .command("gather")
    .description("Gather in-scope Feed Item summaries into a local Gather Sidecar")
    .option("--published-after <timestamp>", "Only include Feed Items published after this epoch millisecond timestamp")
    .option("--published-before <timestamp>", "Only include Feed Items published before this epoch millisecond timestamp")
    .requiredOption("--out <path>", "Path to write the Gather Sidecar JSON")
    .action(async (options) => {
      const gather = await writeGatherInsightFile(options, await getSession());
      console.log(
        JSON.stringify(
          {
            ok: true,
            out: options.out,
            ...gather.coverage,
          },
          null,
          2,
        ),
      );
    });

  const integration = program.command("integration").description("Manage FeedContext delivery integrations");
  const telegram = integration.command("telegram").description("Manage the Telegram delivery integration");
  telegram
    .command("status")
    .description("Print Telegram integration status")
    .action(printTelegramStatus);
  telegram
    .command("binding-link")
    .description("Create a Telegram bot deep link for binding this account")
    .action(printTelegramBindingLink);
  telegram
    .command("disconnect")
    .description("Disconnect Telegram delivery")
    .option("--confirm", "Confirm host approval before disconnecting Telegram")
    .action((options) => disconnectTelegram({ confirm: options.confirm }));

  const artifact = program.command("artifact").description("Upload and deliver generated artifacts");
  artifact
    .command("deliver")
    .description("Upload a final artifact and submit it for Telegram delivery")
    .requiredOption("--file <path>", "Final artifact file to upload")
    .requiredOption("--synthesis-file <path>", "Structured Synthesis JSON sidecar used by the artifact")
    .requiredOption("--artifact-type <type>", "Artifact type: audio_brief or briefing_page")
    .requiredOption("--title <title>", "Plain-text artifact title")
    .option("--content-type <type>", "Override content type: audio/mp4, audio/mpeg, or text/html")
    .option("--display-filename <name>", "Safe display filename; defaults to the uploaded file basename")
    .option("--caption <text>", "Optional Telegram delivery caption")
    .option("--telegram-audio-performer <text>", "Telegram audio performer; defaults to FeedContext for Audio Briefs")
    .option("--telegram-audio-title <text>", "Telegram audio title; defaults to --title for Audio Briefs")
    .option("--telegram-thumbnail-file <path>", "JPEG thumbnail for Telegram audio cards, up to 200 KB")
    .option("--confirm", "Confirm host approval before upload and delivery")
    .action((options) =>
      deliverArtifactCommand({
        artifactType: options.artifactType,
        caption: options.caption,
        confirm: options.confirm,
        contentType: options.contentType,
        displayFilename: options.displayFilename,
        file: options.file,
        synthesisFile: options.synthesisFile,
        telegramAudioPerformer: options.telegramAudioPerformer,
        telegramAudioTitle: options.telegramAudioTitle,
        telegramThumbnailFile: options.telegramThumbnailFile,
        title: options.title,
      }),
    );

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

  const audio = program.command("audio").description("Inspect Audio Brief provider paths");
  const audioProvider = audio.command("provider").description("Inspect audio providers");
  audioProvider
    .command("doctor")
    .description("Report configured Audio Brief provider availability")
    .option("--provider <provider>", "Provider id to inspect, such as bing-edge")
    .action((options) => printAudioProviderDoctor({ provider: options.provider }));
  audio
    .command("segments")
    .description("Convert a Show Script JSON file into speaker-aware TTS segments")
    .requiredOption("--script-file <path>", "Show Script JSON file to convert")
    .requiredOption("--out <path>", "Path to write the TTS segments JSON")
    .action((options) => writeAudioSegmentsFromShowScript(options));
  audio
    .command("render")
    .description("Render spoken text through an Audio Brief provider")
    .option("--provider <provider>", "Provider id to use; defaults to bing-edge")
    .option("--text-file <path>", "Plain text file to synthesize")
    .option("--segments-file <path>", "JSON file with ordered text segments to synthesize")
    .option("--out-dir <path>", "Output directory for segmented audio files")
    .option("--concurrency <count>", "Number of TTS segments to render concurrently", "4")
    .requiredOption("--out <path>", "Output audio file path, or segment manifest path with --segments-file")
    .option("--final-out <path>", "Optional final audio file assembled from rendered segments")
    .option("--display-title <title>", "Optional player-facing title metadata for the final audio file")
    .option("--artwork-file <path>", "Optional unbranded artwork base image to brand, save, and embed")
    .option("--intro-audio <path>", "Optional intro music/audio file to prepend when --final-out is used")
    .option("--outro-audio <path>", "Optional outro music/audio file to append when --final-out is used")
    .option("--no-default-music", "Do not use bundled intro/outro music when --final-out is used")
    .option("--no-timed-script", "Do not write or embed Timed Script playback text when --final-out is used")
    .option("--language <bcp47>", "Spoken language for provider voice selection, such as zh-CN or en-US")
    .option("--voice <voice>", "Provider voice id")
    .action((options) => renderAudio(options));
  await program.parseAsync(argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
