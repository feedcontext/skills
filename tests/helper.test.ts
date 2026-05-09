import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import showScriptSchema from "@/show-script.schema.json" assert { type: "json" };
import structuredSynthesisSchema from "@/structured-synthesis.schema.json" assert { type: "json" };
import {
  buildGetItemPath,
  buildAudioSegmentsFromShowScript,
  buildVersionStatus,
  createSkillAuthUrl,
  buildListItemsPath,
  detectAudioProviders,
  enforceConfirmBeforeNetwork,
  gatherInsight,
  getManyItems,
  getVersionStatus,
  inferArtifactContentType,
  isAllowedRawCall,
  isMutatingRawCall,
  normalizeItemIds,
  parseConcurrency,
  parseItemIdsFile,
  parseOpmlFeedUrls,
  parsePairCode,
  parsePositiveIntegerOption,
  renderBingEdgeTts,
  renderBingEdgeTtsSegments,
  runWithConcurrency,
  SCOPES,
  SKILL_PAIR_ENDPOINT,
  validateShowScript,
  validateStructuredSynthesis,
  writeGatherInsightFile,
} from "@/feedcontext";

describe("FeedContext Skill helper safety", () => {
  it("requests only business scopes from the API Auth Entry", () => {
    expect(SCOPES).toBe("feeds:read subscriptions:read subscriptions:write");
  });

  it("starts auth through the api skill login entry", () => {
    const authorize = createSkillAuthUrl("state_123", "challenge_123");

    expect(authorize.pathname).toBe("/v1/auth/skill");
    expect(authorize.searchParams.get("code_challenge")).toBe("challenge_123");
    expect(authorize.searchParams.has("client_id")).toBe(false);
    expect(authorize.searchParams.get("state")).toBe("state_123");
  });

  it("resolves skill pair codes through the skill-scoped handoff endpoint", () => {
    expect(SKILL_PAIR_ENDPOINT).toBe("/v1/auth/skill/pair");
  });

  it("allows only documented v1 API paths", () => {
    expect(isAllowedRawCall("GET", "/v1/items")).toBe(true);
    expect(isAllowedRawCall("GET", "/v1/items/item_123")).toBe(true);
    expect(isAllowedRawCall("POST", "/v1/subscriptions")).toBe(true);
    expect(isAllowedRawCall("GET", "/v1/integrations/telegram")).toBe(true);
    expect(isAllowedRawCall("POST", "/v1/artifacts")).toBe(true);
    expect(isAllowedRawCall("GET", "/v1/sources")).toBe(false);
    expect(isAllowedRawCall("POST", "/api/auth/sign-in/google")).toBe(false);
  });

  it("requires confirm for mutating calls before network access", () => {
    expect(isMutatingRawCall("POST", "/v1/subscriptions")).toBe(true);
    expect(isMutatingRawCall("POST", "/v1/artifacts")).toBe(true);
    expect(isMutatingRawCall("DELETE", "/v1/integrations/telegram")).toBe(true);
    expect(() =>
      enforceConfirmBeforeNetwork({
        method: "POST",
        path: "/v1/subscriptions",
      }),
    ).toThrow(/--confirm/);
    expect(() =>
      enforceConfirmBeforeNetwork({
        confirm: true,
        method: "POST",
        path: "/v1/subscriptions",
      }),
    ).not.toThrow();
  });

  it("infers artifact upload content types from final file paths", () => {
    expect(inferArtifactContentType("brief.m4a", "audio_brief")).toBe("audio/mp4");
    expect(inferArtifactContentType("brief.mp3", "audio_brief")).toBe("audio/mpeg");
    expect(inferArtifactContentType("brief.html", "briefing_page")).toBe("text/html");
    expect(() => inferArtifactContentType("brief.wav", "audio_brief")).toThrow(/m4a or .mp3/);
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

  it("converts Show Script turns into speaker-aware TTS segments without reading speaker labels", () => {
    const segments = buildAudioSegmentsFromShowScript({
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
          name: "女主播",
          provider_voice: "zh-CN-XiaoxiaoNeural",
          role: "narrative_lead",
        },
        {
          gender: "male",
          id: "host_b",
          name: "男主播",
          provider_voice: "zh-CN-YunxiNeural",
          role: "clarifier",
        },
      ],
      sections: [
        {
          id: "opening",
          title: "Opening",
          turns: [
            {
              speaker: "host_a",
              text: "哈哈，今天这几条新闻看起来分散，但其实有一条暗线。",
              emotion: "warm",
              transition: "opening hook",
            },
            {
              speaker: "host_b",
              text: "我先接一句，这条暗线可能比单条漏洞更值得紧张。",
              emotion: "concerned",
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
    });

    expect(segments).toEqual({
      language: "zh-CN",
      segments: [
        {
          id: "opening-01",
          pitch: "-10Hz",
          rate: "-7%",
          speaker: "host_a",
          speaker_label: "女主播",
          text: "哈哈，今天这几条新闻看起来分散，但其实有一条暗线。",
          voice: "zh-CN-XiaoxiaoNeural",
          voice_persona_id: "bing-edge/zh-CN-XiaoxiaoNeural",
        },
        {
          id: "opening-02",
          pitch: "-12Hz",
          rate: "-5%",
          speaker: "host_b",
          speaker_label: "男主播",
          text: "我先接一句，这条暗线可能比单条漏洞更值得紧张。",
          voice: "zh-CN-YunxiNeural",
          voice_persona_id: "bing-edge/zh-CN-YunxiNeural",
        },
      ],
      title: "Daily Audio Brief",
    });
    expect(segments.segments.map((segment) => segment.text).join("")).not.toContain("女主播");
    expect(segments.segments.map((segment) => segment.text).join("")).not.toContain("男主播");
  });

  it("resolves fixed Chinese Voice Personas when host voices are omitted", () => {
    const segments = buildAudioSegmentsFromShowScript({
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
          role: "narrative_lead",
        },
        {
          gender: "male",
          id: "host_b",
          role: "clarifier",
        },
      ],
      sections: [
        {
          id: "opening",
          title: "Opening",
          turns: [
            { speaker: "host_a", text: "今天先看一个重要变化。" },
            { speaker: "host_b", text: "它的影响可能比表面更深。" },
          ],
        },
      ],
      provider_requirements: {
        multi_voice: true,
        long_form: true,
        segment_generation: true,
        preferred_output_format: "mp3",
      },
    });

    expect(segments).toMatchObject({
      segments: [
        {
          pitch: "-10Hz",
          rate: "-7%",
          speaker_label: "林晓",
          voice: "zh-CN-XiaoxiaoNeural",
          voice_persona_id: "bing-edge/zh-CN-XiaoxiaoNeural",
        },
        {
          pitch: "-12Hz",
          rate: "-5%",
          speaker_label: "周熙",
          voice: "zh-CN-YunxiNeural",
          voice_persona_id: "bing-edge/zh-CN-YunxiNeural",
        },
      ],
    });
  });

  it("keeps host provider_voice as an exact voice override", () => {
    const segments = buildAudioSegmentsFromShowScript({
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
          name: "林晓",
          provider_voice: "zh-CN-XiaoxiaoNeural",
          role: "narrative_lead",
        },
      ],
      sections: [
        {
          id: "opening",
          title: "Opening",
          turns: [{ speaker: "host_a", text: "欢迎回来。" }],
        },
      ],
      provider_requirements: {
        multi_voice: true,
        long_form: true,
        segment_generation: true,
      },
    });

    expect(segments.segments[0]).toMatchObject({
      pitch: "-10Hz",
      rate: "-7%",
      speaker_label: "林晓",
      voice: "zh-CN-XiaoxiaoNeural",
      voice_persona_id: "bing-edge/zh-CN-XiaoxiaoNeural",
    });
  });

  it("applies fixed English Voice Persona prosody", () => {
    const segments = buildAudioSegmentsFromShowScript({
      schema_version: "1",
      source_synthesis: {
        file: "briefing.synthesis.json",
      },
      intent: "script_then_audio",
      language: "en-US",
      format: "two_host",
      title: "Daily Audio Brief",
      hosts: [
        {
          gender: "female",
          id: "host_a",
          role: "narrative_lead",
        },
        {
          gender: "male",
          id: "host_b",
          role: "clarifier",
        },
      ],
      sections: [
        {
          id: "opening",
          title: "Opening",
          turns: [
            { speaker: "host_a", text: "Welcome back." },
            { speaker: "host_b", text: "Let's get started." },
          ],
        },
      ],
      provider_requirements: {
        multi_voice: true,
        long_form: true,
        segment_generation: true,
      },
    });

    expect(segments.segments).toMatchObject([
      {
        pitch: "-3Hz",
        rate: "-2%",
        speaker_label: "Maya",
        voice: "en-US-AvaNeural",
        voice_persona_id: "bing-edge/en-US-AvaNeural",
      },
      {
        pitch: "-4Hz",
        rate: "-2%",
        speaker_label: "Noah",
        voice: "en-US-GuyNeural",
        voice_persona_id: "bing-edge/en-US-GuyNeural",
      },
    ]);
  });
});

describe("FeedContext Audio provider diagnostics", () => {
  it("ships bundled podcast intro and outro music assets", () => {
    expect(existsSync("skills/feedcontext/assets/audio/intro.mp3")).toBe(true);
    expect(existsSync("skills/feedcontext/assets/audio/outro.mp3")).toBe(true);
  });

  it("reports bundled Bing Edge TTS as the default provider", async () => {
    const result = await detectAudioProviders();

    expect(result.default_provider).toBe("bing-edge");
    expect(result.providers).toContainEqual(
      expect.objectContaining({
        available: true,
        default: true,
        id: "bing-edge",
        invocation: expect.objectContaining({
          command: "node scripts/helper.mjs audio render",
          example_args: [
            "--segments-file",
            "show.segments.json",
            "--out-dir",
            "show-segments",
            "--concurrency",
            "4",
            "--out",
            "show.bing-edge.segments.json",
          ],
        }),
        provider_class: "production",
      }),
    );
  });

  it("renders Bing Edge TTS through the bundled msedge-tts package", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-test-"));
    const textFile = join(directory, "spoken.txt");
    const out = join(directory, "audio.mp3");
    const calls: Array<{ out: string; pitch?: string; rate?: string; text: string; voice: string; volume?: string }> = [];

    try {
      await import("node:fs/promises").then(({ writeFile }) =>
        writeFile(textFile, "Hello <from> FeedContext & friends."),
      );

      await renderBingEdgeTts(
        {
          out,
          textFile,
          voice: "en-US-AvaNeural",
        },
        async (input) => {
          calls.push(input);
          await writeFile(input.out, `audio:${input.text}`);
        },
      );

      expect(calls).toEqual([
        {
          out,
          text: "Hello <from> FeedContext & friends.",
          voice: "en-US-AvaNeural",
        },
      ]);
      expect(readFileSync(out, "utf8")).toBe("audio:Hello <from> FeedContext & friends.");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("selects a provider voice that matches the spoken language", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-language-test-"));
    const textFile = join(directory, "spoken.txt");
    const out = join(directory, "audio.mp3");
    const calls: Array<{ out: string; pitch?: string; rate?: string; text: string; voice: string; volume?: string }> = [];

    try {
      await writeFile(textFile, "今天的重点是安全更新。");

      await renderBingEdgeTts(
        {
          language: "zh-CN",
          out,
          textFile,
        },
        async (input) => {
          calls.push(input);
          await writeFile(input.out, "audio");
        },
      );

      expect(calls[0]?.voice).toBe("zh-CN-XiaoxiaoNeural");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("renders Bing Edge TTS segments concurrently", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-segments-test-"));
    const segmentsFile = join(directory, "segments.json");
    const calls: Array<{ out: string; pitch?: string; rate?: string; text: string; voice: string; volume?: string }> = [];
    let active = 0;
    let peak = 0;

    try {
      await import("node:fs/promises").then(({ writeFile }) =>
        writeFile(
          segmentsFile,
          JSON.stringify({
            language: "zh-CN",
            segments: [
              { id: "intro", text: "开场。" },
              { id: "lead", text: "重点。" },
              { id: "close", text: "结束。" },
            ],
          }),
        ),
      );

      const result = await renderBingEdgeTtsSegments(
        {
          concurrency: "2",
          outDir: directory,
          segmentsFile,
        },
        async (input) => {
          active += 1;
          peak = Math.max(peak, active);
          calls.push(input);
          await new Promise((resolve) => setTimeout(resolve, 1));
          await writeFile(input.out, `audio:${input.text}`);
          active -= 1;
        },
      );

      expect(peak).toBe(2);
      expect(calls.map((call) => call.text)).toEqual(["开场。", "重点。", "结束。"]);
      expect(calls.every((call) => call.voice === "zh-CN-XiaoxiaoNeural")).toBe(true);
      expect(result).toMatchObject({
        ok: true,
        provider: "bing-edge",
        segments: [
          { id: "intro", media_file: join(directory, "001-intro.mp3") },
          { id: "lead", media_file: join(directory, "002-lead.mp3") },
          { id: "close", media_file: join(directory, "003-close.mp3") },
        ],
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("passes segment prosody settings to the Bing Edge synthesizer", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-prosody-test-"));
    const segmentsFile = join(directory, "segments.json");
    const calls: Array<{ out: string; pitch?: string; rate?: string; text: string; voice: string; volume?: string }> = [];

    try {
      await writeFile(
        segmentsFile,
        JSON.stringify({
          language: "zh-CN",
          segments: [
            {
              id: "opening",
              pitch: "-4Hz",
              rate: "-8%",
              text: "开场。",
              voice: "zh-CN-XiaoxiaoNeural",
              volume: "default",
            },
          ],
        }),
      );

      await renderBingEdgeTtsSegments(
        {
          outDir: directory,
          segmentsFile,
        },
        async (input) => {
          calls.push(input);
          await writeFile(input.out, "audio");
        },
      );

      expect(calls[0]).toMatchObject({
        pitch: "-4Hz",
        rate: "-8%",
        text: "开场。",
        voice: "zh-CN-XiaoxiaoNeural",
        volume: "default",
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("renders speaker voices per segment and assembles a final podcast file with music", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-final-test-"));
    const segmentsFile = join(directory, "segments.json");
    const finalOut = join(directory, "final.mp3");
    const intro = join(directory, "intro.mp3");
    const outro = join(directory, "outro.mp3");
    const calls: Array<{ out: string; text: string; voice: string }> = [];
    const concatCalls: Array<{ files: string[]; metadata?: { title?: string }; out: string }> = [];

    try {
      await writeFile(intro, "intro");
      await writeFile(outro, "outro");
      await writeFile(
        segmentsFile,
        JSON.stringify({
          language: "zh-CN",
          segments: [
            { id: "opening", speaker: "host_a", text: "开场。", voice: "zh-CN-XiaoxiaoNeural" },
            { id: "reply", speaker: "host_b", text: "回应。", voice: "zh-CN-YunxiNeural" },
          ],
          title: "每日音频简报",
        }),
      );

      const result = await renderBingEdgeTtsSegments(
        {
          finalOut,
          introAudio: intro,
          outDir: directory,
          outroAudio: outro,
          segmentsFile,
        },
        async (input) => {
          calls.push(input);
          await writeFile(input.out, `audio:${input.voice}:${input.text}`);
        },
        async (files, out, metadata) => {
          concatCalls.push({ files, metadata, out });
          await writeFile(out, files.join("\n"));
        },
      );

      expect(calls.map((call) => call.voice)).toEqual([
        "zh-CN-XiaoxiaoNeural",
        "zh-CN-YunxiNeural",
      ]);
      expect(concatCalls).toEqual([
        {
          files: [
            intro,
            join(directory, "001-opening.mp3"),
            join(directory, "002-reply.mp3"),
            outro,
          ],
          metadata: { title: "每日音频简报" },
          out: finalOut,
        },
      ]);
      expect(result).toMatchObject({
        display_title: "每日音频简报",
        final_out: finalOut,
        segments: [
          { speaker: "host_a", voice: "zh-CN-XiaoxiaoNeural" },
          { speaker: "host_b", voice: "zh-CN-YunxiNeural" },
        ],
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("embeds Timed Script playback text for final m4a renders", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-timed-script-test-"));
    const segmentsFile = join(directory, "segments.json");
    const finalOut = join(directory, "final.m4a");
    const embedCalls: Array<{ audioFile: string; sidecarFile: string; text: string }> = [];

    try {
      await writeFile(
        segmentsFile,
        JSON.stringify({
          language: "zh-CN",
          segments: [
            { id: "opening", speaker: "host_a", text: "开场。", voice: "zh-CN-XiaoxiaoNeural" },
            { id: "reply", speaker: "host_b", text: "回应。", voice: "zh-CN-YunxiNeural" },
          ],
          title: "台本标题优先",
        }),
      );

      const result = await renderBingEdgeTtsSegments(
        {
          defaultMusic: false,
          displayTitle: "显式标题优先",
          finalOut,
          outDir: directory,
          segmentsFile,
        },
        async (input) => {
          await writeFile(input.out, `audio:${input.voice}:${input.text}`);
        },
        async (files, out) => {
          await writeFile(out, files.join("\n"));
        },
        async (input) => {
          embedCalls.push(input);
          return { embedded: true, metadata_fields: ["lyrics", "comment"] };
        },
        async (file) => {
          if (file.endsWith("001-opening.mp3")) return 2.25;
          if (file.endsWith("002-reply.mp3")) return 3.5;
          throw new Error(`unexpected duration probe: ${file}`);
        },
      );

      const sidecarFile = join(directory, "final.lyrics.txt");
      const syncedSidecarFile = join(directory, "final.lrc");
      expect(readFileSync(sidecarFile, "utf8")).toBe("host_a: 开场。\n\nhost_b: 回应。\n");
      expect(readFileSync(syncedSidecarFile, "utf8")).toBe(
        "[00:00.00]host_a: 开场。\n[00:02.25]host_b: 回应。\n",
      );
      expect(embedCalls).toEqual([
        {
          audioFile: finalOut,
          sidecarFile,
          text: "host_a: 开场。\n\nhost_b: 回应。\n",
        },
      ]);
      expect(result).toMatchObject({
        display_title: "显式标题优先",
        final_out: finalOut,
        timed_script: {
          embedded: true,
          format: "unsynchronized_lyrics",
          metadata_fields: ["lyrics", "comment"],
          sidecar_file: sidecarFile,
          synced_sidecar_file: syncedSidecarFile,
          timing_source: "none",
          synced_timing_source: "segment_durations",
        },
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("keeps final audio and sidecar when Timed Script embedding fails", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-timed-script-fallback-test-"));
    const segmentsFile = join(directory, "segments.json");
    const finalOut = join(directory, "final.m4a");

    try {
      await writeFile(
        segmentsFile,
        JSON.stringify({
          language: "en-US",
          segments: [{ id: "opening", speaker: "host_a", text: "Opening." }],
        }),
      );

      const result = await renderBingEdgeTtsSegments(
        {
          defaultMusic: false,
          finalOut,
          outDir: directory,
          segmentsFile,
        },
        async (input) => {
          await writeFile(input.out, `audio:${input.voice}:${input.text}`);
        },
        async (files, out) => {
          await writeFile(out, files.join("\n"));
        },
        async () => {
          throw new Error("ffmpeg metadata write failed");
        },
        async (file) => {
          if (file.endsWith("001-opening.mp3")) return 1.5;
          throw new Error(`unexpected duration probe: ${file}`);
        },
      );

      const sidecarFile = join(directory, "final.lyrics.txt");
      const syncedSidecarFile = join(directory, "final.lrc");
      expect(existsSync(finalOut)).toBe(true);
      expect(readFileSync(sidecarFile, "utf8")).toBe("host_a: Opening.\n");
      expect(readFileSync(syncedSidecarFile, "utf8")).toBe("[00:00.00]host_a: Opening.\n");
      expect(result).toMatchObject({
        ok: true,
        timed_script: {
          embedded: false,
          embedding_error: "ffmpeg metadata write failed",
          sidecar_file: sidecarFile,
          synced_sidecar_file: syncedSidecarFile,
          synced_timing_source: "segment_durations",
        },
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("uses bundled intro and outro music for final podcast assembly by default", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-default-music-test-"));
    const segmentsFile = join(directory, "segments.json");
    const finalOut = join(directory, "final.mp3");
    const concatCalls: Array<{ files: string[]; out: string }> = [];

    try {
      await writeFile(
        segmentsFile,
        JSON.stringify({
          language: "en-US",
          segments: [{ id: "opening", text: "Opening." }],
        }),
      );

      const result = await renderBingEdgeTtsSegments(
        {
          finalOut,
          outDir: directory,
          segmentsFile,
        },
        async (input) => {
          await writeFile(input.out, `audio:${input.voice}:${input.text}`);
        },
        async (files, out) => {
          concatCalls.push({ files, out });
          await writeFile(out, files.join("\n"));
        },
      );

      expect(concatCalls).toEqual([
        {
          files: [
            expect.stringMatching(/assets\/audio\/intro\.mp3$/),
            join(directory, "001-opening.mp3"),
            expect.stringMatching(/assets\/audio\/outro\.mp3$/),
          ],
          out: finalOut,
        },
      ]);
      expect(result).toMatchObject({
        final_out: finalOut,
        intro_audio: expect.stringMatching(/assets\/audio\/intro\.mp3$/),
        outro_audio: expect.stringMatching(/assets\/audio\/outro\.mp3$/),
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("can disable bundled intro and outro music for speech-only final assembly", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-bing-tts-no-music-test-"));
    const segmentsFile = join(directory, "segments.json");
    const finalOut = join(directory, "final.mp3");
    const concatCalls: Array<{ files: string[]; out: string }> = [];

    try {
      await writeFile(
        segmentsFile,
        JSON.stringify({
          language: "en-US",
          segments: [{ id: "opening", text: "Opening." }],
        }),
      );

      await renderBingEdgeTtsSegments(
        {
          defaultMusic: false,
          finalOut,
          outDir: directory,
          segmentsFile,
        },
        async (input) => {
          await writeFile(input.out, `audio:${input.voice}:${input.text}`);
        },
        async (files, out) => {
          concatCalls.push({ files, out });
          await writeFile(out, files.join("\n"));
        },
      );

      expect(concatCalls).toEqual([
        {
          files: [join(directory, "001-opening.mp3")],
          out: finalOut,
        },
      ]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
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
    ).toEqual({
      name: "feedcontext",
      installed_revision: "abc123",
      latest_revision: "def456",
      upgrade_available: true,
      upgrade_command: "npx skills update feedcontext",
    });
  });

  it("does not report upgrades when latest revision is unknown", () => {
    expect(
      buildVersionStatus({
        installedRevision: "abc123",
        latestRevision: null,
        upgradeCheckError: "latest_revision_unavailable",
      }),
    ).toEqual({
      name: "feedcontext",
      installed_revision: "abc123",
      latest_revision: null,
      upgrade_available: false,
      upgrade_check_error: "latest_revision_unavailable",
      upgrade_command: "npx skills update feedcontext",
    });
  });

  it("checks the current branch on the origin remote", async () => {
    const calls: string[][] = [];
    const status = await getVersionStatus({
      cwd: "/skill",
      git: async (args) => {
        calls.push(args);
        if (args.join(" ") === "rev-parse HEAD") return "abc123\n";
        if (args.join(" ") === "symbolic-ref --quiet --short HEAD") return "main\n";
        if (args.join(" ") === "ls-remote origin refs/heads/main") {
          return "def456\trefs/heads/main\n";
        }
        throw new Error(`Unexpected git call: ${args.join(" ")}`);
      },
    });

    expect(calls).toEqual([
      ["rev-parse", "HEAD"],
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      ["ls-remote", "origin", "refs/heads/main"],
    ]);
    expect(status).toMatchObject({
      installed_revision: "abc123",
      latest_revision: "def456",
      upgrade_available: true,
    });
  });

  it("falls back to remote HEAD when the checkout is detached", async () => {
    const status = await getVersionStatus({
      cwd: "/skill",
      git: async (args) => {
        if (args.join(" ") === "rev-parse HEAD") return "abc123";
        if (args.join(" ") === "symbolic-ref --quiet --short HEAD") {
          throw new Error("detached");
        }
        if (args.join(" ") === "ls-remote origin HEAD") return "abc123\tHEAD";
        throw new Error(`Unexpected git call: ${args.join(" ")}`);
      },
    });

    expect(status).toMatchObject({
      installed_revision: "abc123",
      latest_revision: "abc123",
      upgrade_available: false,
    });
  });
});

describe("FeedContext Skill helper pair codes", () => {
  it("accepts 6-digit pair codes", () => {
    expect(parsePairCode("123456")).toBe("123456");
  });

  it("rejects non-numeric or wrongly sized pair codes", () => {
    expect(() => parsePairCode("state-only")).toThrow(/Invalid pair code/);
    expect(() => parsePairCode("12345")).toThrow(/Invalid pair code/);
    expect(() => parsePairCode("1234567")).toThrow(/Invalid pair code/);
  });
});

describe("FeedContext OPML import helpers", () => {
  it("extracts unique http and https xmlUrl values from OPML outlines", () => {
    expect(
      parseOpmlFeedUrls(`
        <opml version="2.0">
          <body>
            <outline text="One" xmlUrl="https://example.com/feed.xml#ignored" />
            <outline text="Duplicate" xmlUrl="https://example.com/feed.xml" />
            <outline text="Escaped" xmlUrl="https://example.com/a&amp;b.xml" />
            <outline text="Site only" htmlUrl="https://example.com" />
            <outline text="Local" xmlUrl="file:///tmp/feed.xml" />
          </body>
        </opml>
      `),
    ).toEqual(["https://example.com/feed.xml", "https://example.com/a&b.xml"]);
  });

  it("rejects invalid OPML documents", () => {
    expect(() => parseOpmlFeedUrls("<not-opml></not-opml>")).toThrow(/OPML/i);
  });

  it("defaults OPML import concurrency to 32", () => {
    expect(parseConcurrency(undefined)).toBe(32);
    expect(parseConcurrency("4")).toBe(4);
    expect(() => parseConcurrency("0")).toThrow(/positive integer/);
  });

  it("parses Feed Item ids from JSON or newline files", () => {
    expect(parseItemIdsFile('["item_1","item_2"]')).toEqual(["item_1", "item_2"]);
    expect(parseItemIdsFile("item_1\n\nitem_2\n")).toEqual(["item_1", "item_2"]);
    expect(() => parseItemIdsFile('["item_1", 2]')).toThrow(/array of non-empty strings/);
    expect(() => normalizeItemIds({})).toThrow(/requires at least one/);
  });

  it("runs workers without exceeding the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const results = await runWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("reads multiple Feed Items with bounded local concurrency", async () => {
    const session = { access_token: "token", token_type: "Bearer" as const };
    const calls: string[] = [];
    let active = 0;
    let peak = 0;

    const result = await getManyItems(
      {
        concurrency: "2",
        ids: ["item_1", "item_2", "item_3"],
        maxChars: "8000",
      },
      session,
      async (input) => {
        active += 1;
        peak = Math.max(peak, active);
        calls.push(input.path);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        if (input.path.includes("item_2")) {
          return {
            ok: false,
            status: 404,
            text: JSON.stringify({ message: "not found" }),
          };
        }
        return {
          ok: true,
          status: 200,
          text: JSON.stringify({ id: input.path.split("/")[3]?.split("?")[0], content_text: "body" }),
        };
      },
    );

    expect(calls).toEqual([
      "/v1/items/item_1?max_chars=8000",
      "/v1/items/item_2?max_chars=8000",
      "/v1/items/item_3?max_chars=8000",
    ]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(result).toMatchObject({
      failed: 1,
      ok: false,
      succeeded: 2,
      total: 3,
    });
    expect(result.results[1]).toMatchObject({ error: "not found", id: "item_2", ok: false, status: 404 });
  });
});

describe("FeedContext Feed Item list helpers", () => {
  it("gathers all in-scope Feed Item summaries before aggregation", async () => {
    const calls: string[] = [];
    const session = { access_token: "token", token_type: "Bearer" as const };
    const responses = new Map([
      [
        "/v1/items?published_after=1700000000000&published_before=1700086400000&limit=100",
        {
          items: [
            {
              id: "item_1",
              subscription: {
                feed_url: "https://example.com/feed.xml",
                id: "sub_1",
                title: "Example Feed",
              },
              title: "First",
              author: null,
              url: "https://example.com/first",
              published_at: 1700000100000,
              summary: "First summary",
              created_at: 1700000100000,
            },
          ],
          next_cursor: "1700000100000:item_1",
        },
      ],
      [
        "/v1/items?published_after=1700000000000&published_before=1700086400000&limit=100&cursor=1700000100000%3Aitem_1",
        {
          items: [
            {
              id: "item_2",
              subscription: {
                feed_url: "https://example.com/feed.xml",
                id: "sub_1",
                title: "Example Feed",
              },
              title: "Second",
              author: null,
              url: "https://example.com/second",
              published_at: 1700000200000,
              summary: "Second summary",
              created_at: 1700000200000,
            },
          ],
          next_cursor: null,
        },
      ],
    ]);

    const gather = await gatherInsight(
      {
        publishedAfter: "1700000000000",
        publishedBefore: "1700086400000",
      },
      session,
      async (input) => {
        calls.push(input.path);
        const response = responses.get(input.path);
        if (!response) {
          return { ok: false, status: 404, text: "{}" };
        }
        return { ok: true, status: 200, text: JSON.stringify(response) };
      },
    );

    expect(calls).toEqual([
      "/v1/items?published_after=1700000000000&published_before=1700086400000&limit=100",
      "/v1/items?published_after=1700000000000&published_before=1700086400000&limit=100&cursor=1700000100000%3Aitem_1",
    ]);
    expect(gather.coverage).toMatchObject({
      pages: 2,
      summary_reviewed_count: 2,
      total: 2,
    });
    expect(gather.items).toEqual([
      expect.objectContaining({ id: "item_1", summary: "First summary", summary_reviewed: true }),
      expect.objectContaining({ id: "item_2", summary: "Second summary", summary_reviewed: true }),
    ]);
  });

  it("writes Gather Sidecar JSON for an insight gather run", async () => {
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-gather-test-"));
    const out = join(directory, "today.gather.json");

    try {
      await writeGatherInsightFile(
        {
          out,
          publishedAfter: "1700000000000",
          publishedBefore: "1700086400000",
        },
        { access_token: "token", token_type: "Bearer" },
        async () => ({
          ok: true,
          status: 200,
          text: JSON.stringify({
            items: [
              {
                id: "item_1",
                subscription: {
                  feed_url: "https://example.com/feed.xml",
                  id: "sub_1",
                  title: "Example Feed",
                },
                title: "First",
                author: null,
                url: "https://example.com/first",
                published_at: 1700000100000,
                summary: "First summary",
                created_at: 1700000100000,
              },
            ],
            next_cursor: null,
          }),
        }),
      );

      const written = JSON.parse(readFileSync(out, "utf8"));
      expect(written).toMatchObject({
        schema_version: "1",
        coverage: {
          pages: 1,
          summary_reviewed_count: 1,
          total: 1,
        },
        items: [{ id: "item_1", summary_reviewed: true }],
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds Feed Item read paths with content chunk options", () => {
    expect(
      buildGetItemPath({
        cursor: "12000",
        id: "item_123",
        includeRaw: true,
        maxChars: "8000",
      }),
    ).toBe("/v1/items/item_123?cursor=12000&max_chars=8000&include_raw=true");
  });

  it("builds paginated Feed Item list paths with supported filters", () => {
    expect(
      buildListItemsPath({
        cursor: "1700000000000:item_123",
        ids: ["item_1", "item_2"],
        keyword: "AI agents",
        limit: "100",
        publishedAfter: "1700000000000",
        publishedBefore: "1800000000000",
        searchContent: true,
        subscriptionId: "sub_123",
      }),
    ).toBe(
      "/v1/items?subscription_id=sub_123&keyword=AI+agents&published_after=1700000000000&published_before=1800000000000&limit=100&cursor=1700000000000%3Aitem_123&ids=item_1&ids=item_2&search_content=true",
    );
  });

  it("rejects invalid list limits before network access", () => {
    expect(() =>
      parsePositiveIntegerOption({
        max: 100,
        name: "--limit",
        value: "101",
      }),
    ).toThrow(/less than or equal to 100/);
    expect(() =>
      parsePositiveIntegerOption({
        name: "--max-pages",
        value: "0",
      }),
    ).toThrow(/positive integer/);
  });
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
    expect(errors).toContain(
      "units: must include at least one synthesis unit",
    );
  });
});
