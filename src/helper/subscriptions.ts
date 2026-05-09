import { readFile } from "node:fs/promises";
import { parseOpml } from "feedsmith";
import { getSession } from "./auth";
import { apiRequest } from "./api";
import type { OpmlImportResult } from "./types";
import { parseConcurrency, runWithConcurrency } from "./utils";

export function parseOpmlFeedUrls(document: string) {
  const opml = parseOpml(document);
  const urls: string[] = [];
  const seen = new Set<string>();

  function visit(outlines: Array<{outlines?: unknown; xmlUrl?: unknown}> | undefined) {
    for (const outline of outlines ?? []) {
      const rawXmlUrl = typeof outline.xmlUrl === "string" ? outline.xmlUrl : null;
      if (Array.isArray(outline.outlines)) {
        visit(outline.outlines as Array<{outlines?: unknown; xmlUrl?: unknown}>);
      }

      if (!rawXmlUrl) continue;

      try {
        const feedUrl = normalizeOpmlFeedUrl(rawXmlUrl);
        if (!seen.has(feedUrl)) {
          seen.add(feedUrl);
          urls.push(feedUrl);
        }
      } catch {
        // Non-feed URLs in OPML outlines are ignored by design.
      }
    }
  }

  visit(opml.body?.outlines as Array<{outlines?: unknown; xmlUrl?: unknown}> | undefined);

  return urls;
}

function normalizeOpmlFeedUrl(rawFeedUrl: string) {
  const url = new URL(rawFeedUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("OPML xmlUrl must use http or https.");
  }
  url.hash = "";
  return url.toString();
}

export async function importOpml(options: { concurrency?: string; confirm?: boolean; file: string }) {
  if (!options.confirm) {
    throw new Error("OPML import creates subscriptions and requires --confirm.");
  }

  const concurrency = parseConcurrency(options.concurrency);
  const feedUrls = parseOpmlFeedUrls(await readFile(options.file, "utf8"));
  const session = await getSession();
  const results = await runWithConcurrency(feedUrls, concurrency, async (feedUrl) => {
    try {
      const result = await apiRequest(
        {
          body: { feed_url: feedUrl },
          confirm: true,
          method: "POST",
          path: "/v1/subscriptions",
        },
        session,
      );

      if (result.ok) {
        let created = result.status === 201;
        try {
          const parsed = JSON.parse(result.text) as { created?: boolean };
          created = parsed.created ?? created;
        } catch {
          // Fall back to HTTP status if a future API returns non-JSON success.
        }
        return { created, feedUrl, ok: true as const, status: result.status };
      }

      let error = result.text;
      try {
        const parsed = JSON.parse(result.text) as { message?: string };
        error = parsed.message ?? result.text;
      } catch {
        // Keep the raw response text for non-JSON API errors.
      }
      return { error, feedUrl, ok: false as const, status: result.status };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Subscription create request failed.",
        feedUrl,
        ok: false as const,
      };
    }
  });

  const failed = results
    .filter((result) => !result.ok)
    .map((result) => ({
      error: result.error,
      feed_url: result.feedUrl,
      status: result.status,
    }));
  const succeeded = results.length - failed.length;
  const created = results.filter((result) => result.ok && result.created).length;
  const output: OpmlImportResult = {
    created,
    existing: succeeded - created,
    failed,
    ok: failed.length === 0,
    succeeded,
    total: feedUrls.length,
  };

  console.log(JSON.stringify(output, null, 2));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
