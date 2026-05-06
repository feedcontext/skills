import { describe, expect, it } from "vitest";
import {
  buildGetItemPath,
  buildVersionStatus,
  createSkillAuthUrl,
  buildListItemsPath,
  enforceConfirmBeforeNetwork,
  getVersionStatus,
  isAllowedRawCall,
  isMutatingRawCall,
  parseConcurrency,
  parseOpmlFeedUrls,
  parsePairCode,
  parsePositiveIntegerOption,
  runWithConcurrency,
  SCOPES,
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
