import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import showScriptSchema from "@/show-script.schema.json" assert { type: "json" };
import structuredSynthesisSchema from "@/structured-synthesis.schema.json" assert { type: "json" };
import {
  buildVersionStatus,
  validateShowScript,
  validateStructuredSynthesis,
} from "@/feedcontext";

const execFileAsync = promisify(execFile);

function commandExists(command: string) {
  try {
    execFileSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const realAudioToolingAvailable = commandExists("ffmpeg") && commandExists("ffprobe");

async function runHelper(args: string[]) {
  return execFileAsync("node", ["skills/feedcontext/scripts/helper.mjs", ...args], {
    cwd: new URL("..", import.meta.url),
  });
}

describe("FeedContext Skill local helper command surface", () => {
  it("keeps service interaction commands out of the packed helper", async () => {
    const { stdout } = await runHelper(["--help"]);

    expect(stdout).toContain("version");
    expect(stdout).toContain("synthesis");
    expect(stdout).toContain("show-script");
    expect(stdout).toContain("artifact");
    expect(stdout).toContain("audio");
    for (const command of [
      "login",
      "logout",
      "raw",
      "subscription",
      "item",
      "insight",
      "integration",
    ]) {
      expect(stdout).not.toContain(command);
    }
  });
});

describe("FeedContext Skill helper version action", () => {
  it("reports upgrade availability when revisions differ", () => {
    expect(
      buildVersionStatus({
        installedRevision: "abc123",
        latestRevision: "def456",
      }),
    ).toMatchObject({
      installed_revision: "abc123",
      latest_revision: "def456",
      name: "feedcontext",
      upgrade_available: true,
    });
  });

  it("does not report upgrades when latest revision is unknown", () => {
    expect(
      buildVersionStatus({
        installedRevision: "abc123",
        latestRevision: null,
        upgradeCheckError: "latest_revision_unavailable",
      }),
    ).toMatchObject({
      latest_revision: null,
      upgrade_available: false,
      upgrade_check_error: "latest_revision_unavailable",
    });
  });
});

describe("FeedContext Show Script validation", () => {
  it("keeps the installable schema generated from the source schema", () => {
    const generatedSchema = JSON.parse(
      readFileSync("skills/feedcontext/schemas/show-script.schema.json", "utf8"),
    );

    expect(generatedSchema).toEqual(showScriptSchema);
  });

  it("accepts a valid Show Script", () => {
    expect(
      validateShowScript({
        schema_version: "1",
        source_synthesis: {
          file: "briefing.synthesis.json",
        },
        intent: "script_then_audio",
        language: "zh-CN",
        format: "two_host",
        title: "Daily Audio Brief",
        hosts: [
          {
            gender: "female",
            id: "host_a",
            name: "A",
            provider_voice: "zh-CN-XiaoxiaoNeural",
            voice_persona_id: "bing-edge/zh-CN-XiaoxiaoNeural",
            role: "narrative_lead",
          },
          {
            gender: "male",
            id: "host_b",
            name: "B",
            provider_voice: "zh-CN-YunxiNeural",
            voice_persona_id: "bing-edge/zh-CN-YunxiNeural",
            role: "clarifier",
          },
        ],
        sections: [
          {
            id: "opening",
            title: "Opening",
            synthesis_unit_ids: ["u1"],
            turns: [
              {
                speaker: "host_a",
                text: "Welcome back, I'm A. B is here with me today, and we will start with a quick hello before the main story.",
                emotion: "warm curiosity",
                transition: "soft bridge from context into the lead",
                synthesis_unit_ids: ["u1"],
              },
              {
                speaker: "host_b",
                text: "Good to be here. Let's ease in and then get straight to the concrete news.",
                emotion: "warm",
                transition: "brief host greeting before news setup",
                synthesis_unit_ids: ["u1"],
              },
            ],
          },
        ],
        provider_requirements: {
          multi_voice: true,
          long_form: true,
          segment_generation: true,
          preferred_output_format: "mp3",
        },
      }),
    ).toEqual([]);
  });

  it("reports Show Script validation errors", () => {
    const errors = validateShowScript({
      schema_version: "2",
      source_synthesis: {},
      hosts: [],
      sections: [],
      provider_requirements: {},
    });

    expect(errors).toContain('schema_version: must be "1"');
    expect(errors).toContain("source_synthesis.file: must be a non-empty string");
    expect(errors).toContain("hosts: must include at least one host");
    expect(errors).toContain("sections: must include at least one section");
    expect(errors).toContain("provider_requirements.multi_voice: must be a boolean");
  });

  it("validates a Show Script file through the packed helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-show-script-"));
    const file = join(directory, "script.json");
    await writeFile(
      file,
      JSON.stringify({
        schema_version: "1",
        source_synthesis: { file: "briefing.synthesis.json" },
        intent: "script_only",
        language: "en-US",
        format: "single_host",
        title: "Daily Brief",
        hosts: [{ id: "host_a", role: "host" }],
        sections: [{ id: "intro", title: "Intro", turns: [{ speaker: "host_a", text: "Hello." }] }],
        provider_requirements: {
          multi_voice: false,
          long_form: false,
          segment_generation: false,
        },
      }),
    );

    const { stdout } = await runHelper(["show-script", "validate", "--file", file]);
    expect(stdout).toContain(`Show Script is valid: ${file}`);
  });

  it("creates a stable segment manifest from a Show Script through the packed helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-audio-segments-"));
    const scriptFile = join(directory, "script.json");
    const outFile = join(directory, "segments.json");
    await writeFile(
      scriptFile,
      JSON.stringify({
        schema_version: "1",
        source_synthesis: { file: "briefing.synthesis.json" },
        intent: "script_then_audio",
        language: "en-US",
        format: "two_host",
        title: "Daily Audio Brief",
        hosts: [
          {
            id: "host_a",
            name: "Maya",
            role: "host",
            provider_voice: "en-US-AvaNeural",
            voice_persona_id: "bing-edge/en-US-AvaNeural",
          },
          {
            id: "host_b",
            name: "Noah",
            role: "host",
            provider_voice: "en-US-GuyNeural",
            voice_persona_id: "bing-edge/en-US-GuyNeural",
          },
        ],
        sections: [
          {
            id: "opening",
            title: "Opening",
            synthesis_unit_ids: ["u1"],
            turns: [
              {
                speaker: "host_a",
                text: "Welcome back. The first story is about faster local rendering.",
                synthesis_unit_ids: ["u1"],
                evidence_ids: ["e1"],
              },
              {
                speaker: "host_b",
                text: "That matters because a retry should not rebuild the whole show.",
                transition: "clarify the listener impact",
              },
            ],
          },
        ],
        provider_requirements: {
          multi_voice: true,
          long_form: true,
          segment_generation: true,
          preferred_output_format: "m4a",
        },
      }),
    );

    const { stdout } = await runHelper([
      "audio",
      "segments",
      "--script-file",
      scriptFile,
      "--out",
      outFile,
    ]);
    expect(stdout).toContain(`Audio segments written: ${outFile}`);

    const manifest = JSON.parse(await readFile(outFile, "utf8"));
    expect(manifest).toMatchObject({
      schema_version: "1",
      language: "en-US",
      title: "Daily Audio Brief",
      source_script: { file: scriptFile },
      provider_requirements: {
        preferred_output_format: "m4a",
        segment_generation: true,
      },
    });
    expect(manifest.segments).toEqual([
      {
        id: "opening-001",
        section_id: "opening",
        section_title: "Opening",
        turn_index: 0,
        speaker: "host_a",
        speaker_label: "Maya",
        text: "Welcome back. The first story is about faster local rendering.",
        voice: "en-US-AvaNeural",
        voice_persona_id: "bing-edge/en-US-AvaNeural",
        synthesis_unit_ids: ["u1"],
        evidence_ids: ["e1"],
      },
      {
        id: "opening-002",
        section_id: "opening",
        section_title: "Opening",
        turn_index: 1,
        speaker: "host_b",
        speaker_label: "Noah",
        text: "That matters because a retry should not rebuild the whole show.",
        voice: "en-US-GuyNeural",
        voice_persona_id: "bing-edge/en-US-GuyNeural",
        transition: "clarify the listener impact",
      },
    ]);
  });

  it("writes a resumable render manifest for existing and missing audio segments", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-audio-render-"));
    const segmentDir = join(directory, "segments");
    const segmentsFile = join(directory, "segments.json");
    const manifestOut = join(directory, "render-manifest.json");
    await mkdir(segmentDir);
    await writeFile(join(segmentDir, "opening-001.m4a"), "audio");
    await writeFile(
      segmentsFile,
      JSON.stringify({
        schema_version: "1",
        language: "en-US",
        title: "Daily Audio Brief",
        source_script: { file: "script.json" },
        provider_requirements: {
          preferred_output_format: "m4a",
          segment_generation: true,
        },
        segments: [
          {
            id: "opening-001",
            speaker: "host_a",
            text: "Reusable segment.",
          },
          {
            id: "opening-002",
            speaker: "host_b",
            text: "Missing segment.",
          },
        ],
      }),
    );

    const { stdout } = await runHelper([
      "audio",
      "render",
      "--segments-file",
      segmentsFile,
      "--segment-dir",
      segmentDir,
      "--manifest-out",
      manifestOut,
      "--resume",
    ]);
    expect(stdout).toContain(`Audio render manifest written: ${manifestOut}`);

    const manifest = JSON.parse(await readFile(manifestOut, "utf8"));
    expect(manifest).toMatchObject({
      schema_version: "1",
      source_segments: { file: segmentsFile },
      segment_dir: segmentDir,
      resume: true,
      reusable_count: 1,
      missing_count: 1,
      ready_for_assembly: false,
    });
    expect(manifest.segments).toEqual([
      {
        id: "opening-001",
        file: join(segmentDir, "opening-001.m4a"),
        status: "reuse",
        bytes: 5,
      },
      {
        id: "opening-002",
        file: join(segmentDir, "opening-002.m4a"),
        status: "missing",
      },
    ]);
  });

  it("writes a retry queue for missing or empty audio segments", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-audio-retry-"));
    const segmentDir = join(directory, "segments");
    const segmentsFile = join(directory, "segments.json");
    const manifestOut = join(directory, "render-manifest.json");
    const retryOut = join(directory, "retry-queue.json");
    await mkdir(segmentDir);
    await writeFile(join(segmentDir, "opening-001.m4a"), "audio");
    await writeFile(join(segmentDir, "opening-002.m4a"), "");
    await writeFile(
      segmentsFile,
      JSON.stringify({
        schema_version: "1",
        language: "en-US",
        title: "Daily Audio Brief",
        source_script: { file: "script.json" },
        provider_requirements: {
          preferred_output_format: "m4a",
          segment_generation: true,
        },
        segments: [
          {
            id: "opening-001",
            speaker: "host_a",
            text: "Reusable segment.",
          },
          {
            id: "opening-002",
            speaker: "host_b",
            text: "Empty segment.",
            voice: "en-US-GuyNeural",
          },
          {
            id: "opening-003",
            speaker: "host_a",
            text: "Missing segment.",
            voice: "en-US-AvaNeural",
          },
        ],
      }),
    );

    const { stdout } = await runHelper([
      "audio",
      "render",
      "--segments-file",
      segmentsFile,
      "--segment-dir",
      segmentDir,
      "--manifest-out",
      manifestOut,
      "--retry-out",
      retryOut,
      "--resume",
    ]);
    expect(stdout).toContain(`Audio retry queue written: ${retryOut}`);

    const retryQueue = JSON.parse(await readFile(retryOut, "utf8"));
    expect(retryQueue).toEqual({
      schema_version: "1",
      source_segments: { file: segmentsFile },
      segment_dir: segmentDir,
      segments: [
        {
          id: "opening-002",
          file: join(segmentDir, "opening-002.m4a"),
          reason: "empty",
          speaker: "host_b",
          text: "Empty segment.",
          voice: "en-US-GuyNeural",
        },
        {
          id: "opening-003",
          file: join(segmentDir, "opening-003.m4a"),
          reason: "missing",
          speaker: "host_a",
          text: "Missing segment.",
          voice: "en-US-AvaNeural",
        },
      ],
    });
  });

  it("assembles ready audio segments into a final local audio artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-audio-assemble-"));
    const segmentDir = join(directory, "segments");
    const segmentsFile = join(directory, "segments.json");
    const renderManifestFile = join(directory, "render-manifest.json");
    const outFile = join(directory, "daily-brief.m4a");
    const assembleManifestOut = join(directory, "assembly-manifest.json");
    const fakeFfmpeg = join(directory, "fake-ffmpeg.mjs");
    await mkdir(segmentDir);
    await writeFile(join(segmentDir, "opening-001.m4a"), "audio-1");
    await writeFile(join(segmentDir, "opening-002.m4a"), "audio-2");
    await writeFile(
      fakeFfmpeg,
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const out = process.argv.at(-1);
writeFileSync(out, "assembled audio");
`,
    );
    await chmod(fakeFfmpeg, 0o755);
    await writeFile(
      segmentsFile,
      JSON.stringify({
        schema_version: "1",
        language: "en-US",
        title: "Daily Audio Brief",
        source_script: { file: "script.json" },
        provider_requirements: {
          preferred_output_format: "m4a",
          segment_generation: true,
        },
        segments: [
          {
            id: "opening-001",
            speaker: "host_a",
            speaker_label: "Maya",
            text: "Reusable segment one.",
          },
          {
            id: "opening-002",
            speaker: "host_b",
            speaker_label: "Noah",
            text: "Reusable segment two.",
          },
        ],
      }),
    );
    await writeFile(
      renderManifestFile,
      JSON.stringify({
        schema_version: "1",
        source_segments: { file: segmentsFile },
        segment_dir: segmentDir,
        resume: true,
        reusable_count: 2,
        missing_count: 0,
        ready_for_assembly: true,
        segments: [
          {
            id: "opening-001",
            file: join(segmentDir, "opening-001.m4a"),
            status: "reuse",
            bytes: 7,
          },
          {
            id: "opening-002",
            file: join(segmentDir, "opening-002.m4a"),
            status: "reuse",
            bytes: 7,
          },
        ],
      }),
    );

    const { stdout } = await runHelper([
      "audio",
      "assemble",
      "--render-manifest",
      renderManifestFile,
      "--out",
      outFile,
      "--manifest-out",
      assembleManifestOut,
      "--ffmpeg-bin",
      fakeFfmpeg,
      "--no-default-music",
    ]);
    expect(stdout).toContain(`Audio brief assembled: ${outFile}`);

    await expect(readFile(outFile, "utf8")).resolves.toBe("assembled audio");
    await expect(readFile(`${outFile}.lyrics.txt`, "utf8")).resolves.toContain(
      "Maya: Reusable segment one.",
    );
    const assembleManifest = JSON.parse(await readFile(assembleManifestOut, "utf8"));
    expect(assembleManifest).toMatchObject({
      schema_version: "1",
      source_render_manifest: { file: renderManifestFile },
      source_segments: { file: segmentsFile },
      final_out: outFile,
      title: "Daily Audio Brief",
      artist: "FeedContext",
      album: "Audio Briefs",
      album_artist: "FeedContext",
      lyrics_file: `${outFile}.lyrics.txt`,
      ready_for_review: true,
    });
    expect(assembleManifest.inputs).toEqual([
      { id: "opening-001", file: join(segmentDir, "opening-001.m4a"), kind: "segment" },
      { id: "opening-002", file: join(segmentDir, "opening-002.m4a"), kind: "segment" },
    ]);
  });

  it("repairs and reviews final audio metadata before delivery", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-audio-review-"));
    const audioFile = join(directory, "daily-brief.m4a");
    const assemblyManifest = join(directory, "assembly-manifest.json");
    const reviewOut = join(directory, "review.json");
    const fakeFfprobe = join(directory, "fake-ffprobe.mjs");
    const fakeFfmpeg = join(directory, "fake-ffmpeg.mjs");
    await writeFile(audioFile, "needs repair");
    await writeFile(`${audioFile}.cover.png`, "cover");
    await writeFile(`${audioFile}.lyrics.txt`, "Maya: Reviewed playback text.");
    await writeFile(
      assemblyManifest,
      JSON.stringify({
        schema_version: "1",
        final_out: audioFile,
        title: "Daily Audio Brief",
        artist: "FeedContext",
        album: "Audio Briefs",
        album_artist: "FeedContext",
        lyrics_file: `${audioFile}.lyrics.txt`,
      }),
    );
    await writeFile(
      fakeFfprobe,
      `#!/usr/bin/env node
import { readFileSync } from "node:fs";
const audio = process.argv.at(-1);
if (readFileSync(audio, "utf8").includes("repaired")) {
  console.log(JSON.stringify({
    format: {
      tags: {
        title: "Daily Audio Brief",
        artist: "FeedContext",
        album: "Audio Briefs",
        album_artist: "FeedContext",
        lyrics: "Maya: Reviewed playback text."
      }
    },
    streams: [{ codec_type: "audio" }, { codec_type: "video", disposition: { attached_pic: 1 } }]
  }));
} else {
  console.log(JSON.stringify({ format: { tags: {} }, streams: [{ codec_type: "audio" }] }));
}
`,
    );
    await writeFile(
      fakeFfmpeg,
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const out = process.argv.at(-1);
writeFileSync(out, "repaired audio");
`,
    );
    await chmod(fakeFfprobe, 0o755);
    await chmod(fakeFfmpeg, 0o755);

    const { stdout } = await runHelper([
      "audio",
      "review",
      "--file",
      audioFile,
      "--assembly-manifest",
      assemblyManifest,
      "--out",
      reviewOut,
      "--ffprobe-bin",
      fakeFfprobe,
      "--ffmpeg-bin",
      fakeFfmpeg,
    ]);
    expect(stdout).toContain("Audio review verdict: ready_repaired");

    await expect(readFile(audioFile, "utf8")).resolves.toBe("repaired audio");
    const review = JSON.parse(await readFile(reviewOut, "utf8"));
    expect(review).toMatchObject({
      schema_version: "1",
      file: audioFile,
      assembly_manifest: { file: assemblyManifest },
      verdict: "ready_repaired",
      repaired: true,
      checks: {
        title: true,
        artist: true,
        album: true,
        album_artist: true,
        cover_artwork: true,
        lyrics: true,
      },
    });
  });

  it.skipIf(!realAudioToolingAvailable)(
    "assembles and reviews a real M4A with ffmpeg and ffprobe",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "feedcontext-audio-smoke-"));
      const segmentDir = join(directory, "segments");
      const segmentsFile = join(directory, "segments.json");
      const renderManifestFile = join(directory, "render-manifest.json");
      const audioFile = join(directory, "daily-brief.m4a");
      const assemblyManifest = join(directory, "assembly-manifest.json");
      const reviewOut = join(directory, "review.json");
      await mkdir(segmentDir);
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=44100:cl=mono",
        "-t",
        "0.2",
        "-c:a",
        "aac",
        join(segmentDir, "opening-001.m4a"),
      ]);
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=44100:cl=mono",
        "-t",
        "0.2",
        "-c:a",
        "aac",
        join(segmentDir, "opening-002.m4a"),
      ]);
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=32x32",
        "-frames:v",
        "1",
        join(directory, "daily-brief.cover.png"),
      ]);
      await writeFile(
        segmentsFile,
        JSON.stringify({
          schema_version: "1",
          language: "en-US",
          title: "Smoke Audio Brief",
          source_script: { file: "script.json" },
          provider_requirements: {
            preferred_output_format: "m4a",
            segment_generation: true,
          },
          segments: [
            {
              id: "opening-001",
              speaker_label: "Maya",
              text: "Smoke segment one.",
            },
            {
              id: "opening-002",
              speaker_label: "Noah",
              text: "Smoke segment two.",
            },
          ],
        }),
      );

      await runHelper([
        "audio",
        "render",
        "--segments-file",
        segmentsFile,
        "--segment-dir",
        segmentDir,
        "--manifest-out",
        renderManifestFile,
        "--resume",
      ]);
      await runHelper([
        "audio",
        "assemble",
        "--render-manifest",
        renderManifestFile,
        "--out",
        audioFile,
        "--manifest-out",
        assemblyManifest,
        "--no-default-music",
      ]);
      await runHelper([
        "audio",
        "review",
        "--file",
        audioFile,
        "--assembly-manifest",
        assemblyManifest,
        "--out",
        reviewOut,
      ]);

      const review = JSON.parse(await readFile(reviewOut, "utf8"));
      expect(review).toMatchObject({
        verdict: "ready_repaired",
        checks: {
          title: true,
          artist: true,
          album: true,
          album_artist: true,
          cover_artwork: true,
          lyrics: true,
        },
      });
    },
  );
});

describe("FeedContext Structured Synthesis validation", () => {
  it("keeps the installable schema generated from the source schema", () => {
    const generatedSchema = JSON.parse(
      readFileSync("skills/feedcontext/schemas/structured-synthesis.schema.json", "utf8"),
    );

    expect(generatedSchema).toEqual(structuredSynthesisSchema);
  });

  it("accepts a valid Structured Synthesis", () => {
    expect(
      validateStructuredSynthesis({
        schema_version: "1",
        scope: {
          request: "Brief me on agent news.",
          selection_rule: "Latest relevant Feed Items.",
        },
        units: [
          {
            claim: "Agent tooling changed this week.",
            id: "u1",
            rendering_priority: "lead",
            selection_rationale: "Directly answers the request.",
            supporting_evidence: [
              {
                feed_item_id: "item_1",
                kind: "feed_item",
                reason: "Primary report.",
                relevance: "direct",
                subscription_title: "Agent Feed",
                title: "Agent Update",
                url: "https://example.com/agent-update",
              },
            ],
            title: "Agent tooling",
            type: "insight",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("reports validation errors", () => {
    const errors = validateStructuredSynthesis({ schema_version: "2", units: [] });

    expect(errors).toContain('schema_version: must be "1"');
    expect(errors).toContain("units: must include at least one synthesis unit");
  });

  it("validates a Structured Synthesis file through the packed helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-synthesis-"));
    const file = join(directory, "briefing.synthesis.json");
    await writeFile(
      file,
      JSON.stringify({
        schema_version: "1",
        scope: {
          request: "Brief me.",
          selection_rule: "Use selected Feed Items.",
        },
        units: [
          {
            claim: "A relevant event happened.",
            id: "u1",
            rendering_priority: "lead",
            selection_rationale: "Directly relevant.",
            supporting_evidence: [
              {
                feed_item_id: "item_1",
                kind: "feed_item",
                reason: "Primary evidence.",
                relevance: "direct",
                subscription_title: "Example Feed",
                title: "Example Item",
                url: "https://example.com/item",
              },
            ],
            title: "Relevant event",
            type: "insight",
          },
        ],
      }),
    );

    const { stdout } = await runHelper(["synthesis", "validate", "--file", file]);
    expect(stdout).toContain(`Structured synthesis is valid: ${file}`);
  });

  it("renders a complete Briefing Page from Structured Synthesis through the packed helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-render-page-"));
    const synthesisFile = join(directory, "briefing.synthesis.json");
    const outFile = join(directory, "briefing.html");
    await writeFile(
      synthesisFile,
      JSON.stringify({
        schema_version: "1",
        scope: {
          request: "Daily Platform Brief",
          selection_rule: "Render the selected platform stories.",
          time_range: { label: "May 12, 2026" },
        },
        units: [
          {
            claim: "Platform teams are tightening their release workflows.",
            id: "platform-release",
            rendering_priority: "lead",
            selection_rationale: "This is the most consequential cross-feed pattern.",
            supporting_evidence: [
              {
                feed_item_id: "item_1",
                kind: "feed_item",
                reason: "Primary report on release workflow changes.",
                relevance: "direct",
                subscription_title: "Platform Feed",
                title: "Release Workflow Changes",
                url: "https://example.com/release",
                published_at: 1778601600000,
              },
            ],
            title: "Release workflows tighten",
            type: "insight",
          },
          {
            claim: "Tooling updates are clustering around agent handoff.",
            id: "agent-handoff",
            rendering_priority: "main",
            selection_rationale: "This supports the lead with a concrete tooling shift.",
            supporting_evidence: [
              {
                feed_item_id: "item_2",
                kind: "feed_item",
                reason: "Shows a related tooling update.",
                relevance: "supporting",
                subscription_title: "Agent Feed",
                title: "Agent Handoff Update",
                url: "https://example.com/handoff",
              },
            ],
            title: "Agent handoff gets sharper",
            type: "insight",
          },
        ],
      }),
    );

    const { stdout } = await runHelper([
      "artifact",
      "render-page",
      "--synthesis-file",
      synthesisFile,
      "--out",
      outFile,
    ]);
    expect(stdout).toContain(`Briefing page rendered: ${outFile}`);

    const html = await readFile(outFile, "utf8");
    expect(html).toContain("<title>Daily Platform Brief</title>");
    expect(html).toContain('data-mode-content="newspaper"');
    expect(html).toContain('data-mode-content="narrative"');
    expect(html).toContain('data-unit-id="platform-release"');
    expect(html).toContain('data-unit-id="agent-handoff"');
    expect(html).toContain("https://example.com/release");
    expect(html).toContain("https://example.com/handoff");
  });
});
