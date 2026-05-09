import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function runHelper(args: string[], cwd: string) {
  return execFileAsync("node", ["skills/feedcontext/scripts/helper.mjs", ...args], {
    cwd,
    env: {
      ...process.env,
      FEEDCONTEXT_TEST_FIXTURE_TTS: "1",
    },
    timeout: 120_000,
  });
}

describe("FeedContext Audio Brief CLI smoke test", () => {
  it("renders a Show Script into final M4A audio with embedded Timed Script metadata", async () => {
    const packageRoot = process.cwd();
    const directory = mkdtempSync(join(tmpdir(), "feedcontext-audio-e2e-"));
    const scriptFile = join(directory, "brief.script.json");
    const segmentsFile = join(directory, "brief.segments.json");
    const segmentsOutDir = join(directory, "segments");
    const finalOut = join(directory, "brief.bing-edge.m4a");
    const manifestFile = join(directory, "brief.bing-edge.render-manifest.json");
    const lyricsFile = join(directory, "brief.bing-edge.lyrics.txt");
    const syncedLyricsFile = join(directory, "brief.bing-edge.lrc");

    try {
      await writeFile(
        scriptFile,
        JSON.stringify(
          {
            schema_version: "1",
            source_synthesis: {
              file: "brief.synthesis.json",
            },
            intent: "script_then_audio",
            language: "en-US",
            format: "two_host",
            title: "Smoke Test Audio Brief",
            hosts: [
              {
                id: "host_a",
                name: "Host A",
                role: "narrative_lead",
                gender: "female",
                provider_voice: "en-US-AvaNeural",
              },
              {
                id: "host_b",
                name: "Host B",
                role: "clarifier",
                gender: "male",
                provider_voice: "en-US-GuyNeural",
              },
            ],
            sections: [
              {
                id: "opening",
                title: "Opening",
                turns: [
                  {
                    speaker: "host_a",
                    text: "Welcome back. This is the short smoke test.",
                  },
                  {
                    speaker: "host_b",
                    text: "And this line verifies the second host appears in playback text.",
                  },
                ],
              },
            ],
            provider_requirements: {
              multi_voice: true,
              long_form: false,
              segment_generation: true,
              preferred_output_format: "m4a",
            },
          },
          null,
          2,
        ),
      );

      await runHelper(["audio", "segments", "--script-file", scriptFile, "--out", segmentsFile], packageRoot);
      await runHelper(
        [
          "audio",
          "render",
          "--segments-file",
          segmentsFile,
          "--out-dir",
          segmentsOutDir,
          "--concurrency",
          "2",
          "--final-out",
          finalOut,
          "--out",
          manifestFile,
          "--no-default-music",
        ],
        packageRoot,
      );

      const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as {
        final_out?: string;
        timed_script?: {
          embedded?: boolean;
          metadata_fields?: string[];
          sidecar_file?: string;
          synced_sidecar_file?: string;
          synced_timing_source?: string;
        };
      };
      const lyrics = readFileSync(lyricsFile, "utf8");
      const syncedLyrics = readFileSync(syncedLyricsFile, "utf8");
      const metadata = await execFileAsync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format_tags=title,artist,album,lyrics,comment",
          "-of",
          "json",
          finalOut,
        ],
        { timeout: 30_000 },
      );

      expect(existsSync(finalOut)).toBe(true);
      expect(manifest.final_out).toBe(finalOut);
      expect(manifest.timed_script).toMatchObject({
        embedded: true,
        metadata_fields: ["lyrics", "comment"],
        sidecar_file: lyricsFile,
        synced_sidecar_file: syncedLyricsFile,
        synced_timing_source: "segment_durations",
      });
      expect(lyrics).toContain("host_a: Welcome back.");
      expect(lyrics).toContain("host_b: And this line verifies");
      expect(syncedLyrics).toContain("[00:00.00]host_a: Welcome back.");
      expect(syncedLyrics).toMatch(/\[00:04\.[0-9]{2}\]host_b: And this line verifies/);
      expect(metadata.stdout).toContain("Welcome back");
      expect(metadata.stdout).toContain("brief.bing-edge");
      expect(metadata.stdout).toContain("FeedContext");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
