import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
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
    for (const command of [
      "login",
      "logout",
      "raw",
      "subscription",
      "item",
      "insight",
      "integration",
      "artifact",
      "audio",
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
});
