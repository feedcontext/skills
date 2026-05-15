import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildVersionStatus,
  validateArtifactSizing,
  validateShowScript,
  validateStructuredSynthesis,
} from "@/feedcontext";

const execFileAsync = promisify(execFile);
let schemaServer: Server;
let schemaBaseUrl: string;
let schemaRequests: string[];

beforeAll(async () => {
  schemaServer = createServer((request, response) => {
    schemaRequests.push(request.url ?? "");
    response.setHeader("content-type", "application/schema+json");
    response.end(JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: request.url,
      type: "object",
      required: ["schema_version"],
      properties: {
        schema_version: { const: "1" },
      },
    }));
  });
  await new Promise<void>((resolve) => {
    schemaServer.listen(0, "127.0.0.1", resolve);
  });
  const address = schemaServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start schema test server");
  }
  schemaBaseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  schemaRequests = [];
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    schemaServer.close((error) => error ? reject(error) : resolve());
  });
});

async function runHelper(args: string[]) {
  return execFileAsync("node", ["skills/feedcontext/scripts/helper.mjs", ...args], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      FEEDCONTEXT_SCHEMA_BASE_URL: schemaBaseUrl,
    },
  });
}

describe("FeedContext Skill local helper command surface", () => {
  it("keeps service interaction commands out of the packed helper", async () => {
    const { stdout } = await runHelper(["--help"]);

    expect(stdout).toContain("version");
    expect(stdout).toContain("synthesis");
    expect(stdout).toContain("show-script");
    expect(stdout).toContain("sizing");
    for (const command of [
      "login",
      "logout",
      "raw",
      "subscription",
      "item",
      "insight",
      "integration",
      "audio",
    ]) {
      expect(stdout).not.toContain(command);
    }
  });
});

describe("FeedContext Artifact Sizing validation", () => {
  it("accepts valid newspaper sizing reviews", () => {
    expect(
      validateArtifactSizing({
        schema_version: "1",
        artifact_type: "briefing_page",
        language: "cjk",
        units: [
          {
            synthesis_unit_id: "u1",
            type: "insight",
            rendering_priority: "lead",
            medium: "newspaper",
            text: "这".repeat(900),
          },
          {
            synthesis_unit_id: "u2",
            type: "item_roundup",
            rendering_priority: "collapsed",
            medium: "newspaper",
            text: "这".repeat(60),
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects newspaper sizing that does not fit the role and type", () => {
    const errors = validateArtifactSizing({
      schema_version: "1",
      artifact_type: "briefing_page",
      language: "latin",
      units: [
        {
          synthesis_unit_id: "u1",
          type: "insight",
          rendering_priority: "lead",
          medium: "newspaper",
          text: "too short",
        },
      ],
    });

    expect(errors).toContain(
      "units.0.text: 2 words does not fit lead/insight newspaper range 450-800",
    );
  });

  it("accepts valid podcast sizing reviews", () => {
    expect(
      validateArtifactSizing({
        schema_version: "1",
        artifact_type: "audio_brief",
        language: "latin",
        units: [
          {
            synthesis_unit_id: "u1",
            type: "insight",
            rendering_priority: "main",
            medium: "podcast",
            target_duration_seconds: 120,
            text: Array.from({ length: 280 }, (_, index) => `word${index}`).join(" "),
          },
        ],
      }),
    ).toEqual([]);
  });

  it("validates an Artifact Sizing Review file through the packed helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-sizing-"));
    const file = join(directory, "artifact-sizing.json");
    await writeFile(
      file,
      JSON.stringify({
        schema_version: "1",
        artifact_type: "audio_brief",
        language: "cjk",
        units: [
          {
            synthesis_unit_id: "u1",
            type: "insight",
            rendering_priority: "secondary",
            medium: "podcast",
            target_duration_seconds: 60,
            text: "这".repeat(260),
          },
        ],
      }),
    );

    const { stdout } = await runHelper(["sizing", "validate", "--file", file]);
    expect(stdout).toContain(`Artifact sizing is valid: ${file}`);
    expect(schemaRequests).toEqual(["/schemas/artifact-sizing-review.v1.schema.json"]);
  });

  it("fetches the canonical schema for every packed helper validation run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "feedcontext-sizing-"));
    const file = join(directory, "artifact-sizing.json");
    await writeFile(
      file,
      JSON.stringify({
        schema_version: "1",
        artifact_type: "briefing_page",
        language: "cjk",
        units: [
          {
            synthesis_unit_id: "u1",
            type: "item_roundup",
            rendering_priority: "collapsed",
            medium: "newspaper",
            text: "这".repeat(60),
          },
        ],
      }),
    );

    await runHelper(["sizing", "validate", "--file", file]);
    await runHelper(["sizing", "validate", "--file", file]);

    expect(schemaRequests).toEqual([
      "/schemas/artifact-sizing-review.v1.schema.json",
      "/schemas/artifact-sizing-review.v1.schema.json",
    ]);
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
