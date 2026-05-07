import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import showScriptSchema from "@/show-script.schema.json" assert { type: "json" };
import structuredSynthesisSchema from "@/structured-synthesis.schema.json" assert { type: "json" };
import {
  buildGetItemPath,
  buildVersionStatus,
  createSkillAuthUrl,
  buildListItemsPath,
  enforceConfirmBeforeNetwork,
  gatherInsight,
  getVersionStatus,
  isAllowedRawCall,
  isMutatingRawCall,
  parseConcurrency,
  parseOpmlFeedUrls,
  parsePairCode,
  parsePositiveIntegerOption,
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
    expect(isAllowedRawCall("GET", "/v1/sources")).toBe(false);
    expect(isAllowedRawCall("POST", "/api/auth/sign-in/google")).toBe(false);
  });

  it("requires confirm for mutating calls before network access", () => {
    expect(isMutatingRawCall("POST", "/v1/subscriptions")).toBe(true);
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
            id: "host_a",
            name: "A",
            role: "narrative_lead",
          },
          {
            id: "host_b",
            name: "B",
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
                text: "Today, the important point is how several signals connect.",
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
      upgrade_command: "npx skills install feedcontext",
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
      upgrade_command: "npx skills install feedcontext",
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
