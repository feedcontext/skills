import { readFile, writeFile } from "node:fs/promises";
import { getSession } from "./auth";
import { apiRequest } from "./api";
import type { ApiRequester, ApiResult, GatherInsightFileOptions, GatherInsightItem, GatherInsightResult, GetItemOptions, GetManyItemsOptions, GetManyItemsResult, ListAllItemsOptions, ListItemsOptions, ListItemsResponse, SkillSession } from "./types";
import { isRecord, normalizeItemIds, parseConcurrency, parsePositiveIntegerOption, runWithConcurrency } from "./utils";

export function buildListItemsPath(options: ListItemsOptions = {}) {
  const params = new URLSearchParams();
  if (options.subscriptionId) params.set("subscription_id", options.subscriptionId);
  if (options.keyword) params.set("keyword", options.keyword);
  if (options.publishedAfter) params.set("published_after", options.publishedAfter);
  if (options.publishedBefore) params.set("published_before", options.publishedBefore);
  if (options.limit) {
    params.set(
      "limit",
      String(
        parsePositiveIntegerOption({
          max: 100,
          name: "--limit",
          value: options.limit,
        }),
      ),
    );
  }
  if (options.cursor) params.set("cursor", options.cursor);
  for (const id of options.ids ?? []) {
    params.append("ids", id);
  }
  if (options.searchContent) params.set("search_content", "true");

  const query = params.toString();
  return `/v1/items${query ? `?${query}` : ""}`;
}

export function buildGetItemPath(options: GetItemOptions) {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.maxChars) {
    params.set(
      "max_chars",
      String(
        parsePositiveIntegerOption({
          max: 20000,
          name: "--max-chars",
          value: options.maxChars,
        }),
      ),
    );
  }
  if (options.includeRaw) params.set("include_raw", "true");

  const query = params.toString();
  return `/v1/items/${encodeURIComponent(options.id)}${query ? `?${query}` : ""}`;
}

function parseListItemsResponse(result: ApiResult) {
  try {
    const parsed = JSON.parse(result.text) as Partial<ListItemsResponse>;
    if (!Array.isArray(parsed.items)) {
      throw new Error("Missing items array.");
    }
    return {
      items: parsed.items,
      next_cursor: typeof parsed.next_cursor === "string" ? parsed.next_cursor : null,
    } satisfies ListItemsResponse;
  } catch (error) {
    throw new Error(
      `Invalid list items response: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function listAllItems(options: ListAllItemsOptions) {
  const limit = parsePositiveIntegerOption({
    defaultValue: 100,
    max: 100,
    name: "--limit",
    value: options.limit,
  });
  const maxPages =
    parsePositiveIntegerOption({
      defaultValue: 1000,
      name: "--max-pages",
      value: options.maxPages,
    }) ?? 1000;
  const session = await getSession();
  const items: unknown[] = [];
  let cursor = options.cursor;
  let pages = 0;

  while (pages < maxPages) {
    const result = await apiRequest(
      {
        method: "GET",
        path: buildListItemsPath({
          ...options,
          cursor,
          limit: String(limit),
        }),
      },
      session,
    );

    if (!result.ok) {
      process.stdout.write(result.text);
      process.exitCode = 1;
      return;
    }

    const page = parseListItemsResponse(result);
    items.push(...page.items);
    pages += 1;
    if (!page.next_cursor) {
      console.log(
        JSON.stringify(
          {
            items,
            next_cursor: null,
            pages,
            total: items.length,
          },
          null,
          2,
        ),
      );
      return;
    }
    cursor = page.next_cursor;
  }

  console.log(
    JSON.stringify(
      {
        items,
        next_cursor: cursor ?? null,
        pages,
        total: items.length,
        truncated: true,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

export async function getManyItems(
  options: GetManyItemsOptions,
  session: SkillSession,
  request: ApiRequester = apiRequest,
): Promise<GetManyItemsResult> {
  const ids = normalizeItemIds({
    ids: options.ids,
    idsFileContent: options.idsFile ? await readFile(options.idsFile, "utf8") : undefined,
  });
  const concurrency = parseConcurrency(options.concurrency, 8);
  const results = await runWithConcurrency(ids, concurrency, async (id) => {
    const result = await request(
      {
        method: "GET",
        path: buildGetItemPath({
          id,
          includeRaw: options.includeRaw,
          maxChars: options.maxChars,
        }),
      },
      session,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = undefined;
    }

    if (!result.ok) {
      return {
        error:
          parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string"
            ? parsed.message
            : result.text || `HTTP ${result.status}`,
        id,
        ok: false as const,
        ...(parsed === undefined ? {} : { response: parsed }),
        status: result.status,
      };
    }

    return {
      id,
      ok: true as const,
      response: parsed ?? result.text,
      status: result.status,
    };
  });
  const succeeded = results.filter((result) => result.ok).length;

  return {
    failed: results.length - succeeded,
    ok: succeeded === results.length,
    results,
    succeeded,
    total: results.length,
  };
}

export async function getManyItemsCommand(options: GetManyItemsOptions) {
  const result = await getManyItems(options, await getSession());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

export async function gatherInsight(
  options: ListItemsOptions,
  session: SkillSession,
  request: ApiRequester = apiRequest,
): Promise<GatherInsightResult> {
  const limit = parsePositiveIntegerOption({
    defaultValue: 100,
    max: 100,
    name: "--limit",
    value: options.limit,
  });
  const items: GatherInsightItem[] = [];
  let cursor = options.cursor;
  let pages = 0;

  while (true) {
    const result = await request(
      {
        method: "GET",
        path: buildListItemsPath({
          ...options,
          cursor,
          limit: String(limit),
        }),
      },
      session,
    );

    if (!result.ok) {
      throw new Error(`Feed Item list request failed with ${result.status}: ${result.text}`);
    }

    const page = parseListItemsResponse(result);
    for (const item of page.items) {
      const record = isRecord(item) ? item : { value: item };
      items.push({
        ...record,
        summary_reviewed: true,
      });
    }
    pages += 1;

    if (!page.next_cursor) {
      return {
        coverage: {
          pages,
          summary_reviewed_count: items.length,
          total: items.length,
        },
        items,
        schema_version: "1",
      };
    }

    cursor = page.next_cursor;
  }
}

export async function writeGatherInsightFile(
  options: GatherInsightFileOptions,
  session: SkillSession,
  request: ApiRequester = apiRequest,
) {
  const gather = await gatherInsight(options, session, request);
  await writeFile(options.out, `${JSON.stringify(gather, null, 2)}\n`);
  return gather;
}
