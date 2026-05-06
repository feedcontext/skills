#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseOpml } from "feedsmith";
import allowlist from "@/allowlist.json" assert { type: "json" };

export type SkillSession = {
  access_token: string;
  expires_at?: number;
  refresh_token?: string;
  token_type: "Bearer";
};

type RawCall = {
  body?: unknown;
  confirm?: boolean;
  method: string;
  path: string;
};

type ApiResult = {
  ok: boolean;
  status: number;
  text: string;
};

type OpmlImportResult = {
  created: number;
  existing: number;
  failed: Array<{ error: string; feed_url: string; status?: number }>;
  ok: boolean;
  succeeded: number;
  total: number;
};

type ListItemsOptions = {
  cursor?: string;
  ids?: string[];
  keyword?: string;
  limit?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  searchContent?: boolean;
  subscriptionId?: string;
};

type ListAllItemsOptions = ListItemsOptions & {
  maxPages?: string;
};

type GetItemOptions = {
  cursor?: string;
  id: string;
  includeRaw?: boolean;
  maxChars?: string;
};

type ListItemsResponse = {
  items: unknown[];
  next_cursor: string | null;
};

export type VersionStatus = {
  name: string;
  installed_revision: string | null;
  latest_revision: string | null;
  upgrade_available: boolean;
  upgrade_check_error?: string;
  upgrade_command: string;
};

type GitRunner = (args: string[], cwd: string) => Promise<string>;

type PendingLogin = {
  created_at: number;
  redirect_uri: string;
  state: string;
  verifier: string;
};

export const API_ORIGIN = process.env.FEEDCONTEXT_API_ORIGIN ?? "https://api.feedcontext.io";
export const WEB_ORIGIN = process.env.FEEDCONTEXT_WEB_ORIGIN ?? "https://feedcontext.io";
export const AUTH_BASE = `${API_ORIGIN}/api/auth`;
export const CLIENT_ID = "feedcontext-skill";
export const REDIRECT_URI = `${WEB_ORIGIN}/pair`;
export const SCOPES = "feeds:read subscriptions:read subscriptions:write";

const SERVICE = "feedcontext.skill";
const ACCOUNT = "default";
const FALLBACK_PATH = join(homedir(), ".feedcontext", "skill-session.json");
const PENDING_LOGIN_PATH = join(homedir(), ".feedcontext", "pending-login.json");
const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;
const ALLOWLIST = allowlist.paths;
const HELPER_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = "feedcontext";
const UPGRADE_COMMAND = "npx skills install feedcontext";

function stripQuery(path: string) {
  return path.split("?", 1)[0] || "/";
}

export function isAllowedRawCall(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = stripQuery(path);
  return ALLOWLIST.some(
    (entry) =>
      entry.method === normalizedMethod &&
      new RegExp(`^${entry.path.replace(/\{[^/]+\}/g, "[^/]+")}$`).test(normalizedPath),
  );
}

export function isMutatingRawCall(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = stripQuery(path);
  return ALLOWLIST.some(
    (entry) =>
      entry.mutating &&
      entry.method === normalizedMethod &&
      new RegExp(`^${entry.path.replace(/\{[^/]+\}/g, "[^/]+")}$`).test(normalizedPath),
  );
}

export function enforceConfirmBeforeNetwork(input: RawCall) {
  if (isMutatingRawCall(input.method, input.path) && !input.confirm) {
    throw new Error("Write calls require host approval and --confirm before network access.");
  }
}

function base64Url(input: Buffer) {
  return input.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { challenge, verifier };
}

async function runGit(args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    execFile("git", ["-C", cwd, ...args], { timeout: 3000 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function parseLsRemoteHead(output: string) {
  return output.trim().split(/\s+/, 1)[0] || null;
}

function normalizeRevision(revision: string | null) {
  return revision?.trim() || null;
}

export function buildVersionStatus(input: {
  installedRevision?: string | null;
  latestRevision?: string | null;
  upgradeCheckError?: string;
}): VersionStatus {
  const installedRevision = normalizeRevision(input.installedRevision ?? null);
  const latestRevision = normalizeRevision(input.latestRevision ?? null);
  return {
    name: SKILL_NAME,
    installed_revision: installedRevision,
    latest_revision: latestRevision,
    upgrade_available: Boolean(
      installedRevision && latestRevision && installedRevision !== latestRevision,
    ),
    ...(input.upgradeCheckError ? { upgrade_check_error: input.upgradeCheckError } : {}),
    upgrade_command: UPGRADE_COMMAND,
  };
}

export async function getVersionStatus({
  cwd = HELPER_DIR,
  git = runGit,
}: {
  cwd?: string;
  git?: GitRunner;
} = {}): Promise<VersionStatus> {
  let installedRevision: string | null = null;
  let latestRevision: string | null = null;
  let upgradeCheckError: string | undefined;

  try {
    installedRevision = normalizeRevision(await git(["rev-parse", "HEAD"], cwd));
  } catch {
    upgradeCheckError = "installed_revision_unavailable";
  }

  try {
    let branch: string | null = null;
    try {
      branch = normalizeRevision(await git(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd));
    } catch {
      branch = null;
    }
    const remoteRef = branch ? `refs/heads/${branch}` : "HEAD";
    latestRevision = parseLsRemoteHead(await git(["ls-remote", "origin", remoteRef], cwd));
  } catch {
    upgradeCheckError ??= "latest_revision_unavailable";
  }

  return buildVersionStatus({
    installedRevision,
    latestRevision,
    upgradeCheckError,
  });
}

async function macKeychainRead() {
  if (platform() !== "darwin") return null;
  return new Promise<string | null>((resolve) => {
    execFile(
      "security",
      ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"],
      (error, stdout) => {
        resolve(error ? null : stdout.trim());
      },
    );
  });
}

async function macKeychainWrite(value: string) {
  if (platform() !== "darwin") return false;
  return new Promise<boolean>((resolve) => {
    execFile(
      "security",
      ["add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", value],
      (error) => resolve(!error),
    );
  });
}

async function macKeychainDelete() {
  if (platform() !== "darwin") return false;
  return new Promise<boolean>((resolve) => {
    execFile("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT], (error) =>
      resolve(!error),
    );
  });
}

async function readFallbackSession() {
  try {
    return await readFile(FALLBACK_PATH, "utf8");
  } catch {
    return null;
  }
}

async function clearFallbackSession() {
  try {
    await unlink(FALLBACK_PATH);
    return true;
  } catch {
    return false;
  }
}

async function writeFallbackSession(value: string) {
  await mkdir(dirname(FALLBACK_PATH), { recursive: true, mode: 0o700 });
  await writeFile(FALLBACK_PATH, value, { mode: 0o600 });
  console.error(
    `Warning: system credential store unavailable; stored session at ${FALLBACK_PATH} with restrictive permissions.`,
  );
}

async function readPendingLogin() {
  try {
    return JSON.parse(await readFile(PENDING_LOGIN_PATH, "utf8")) as PendingLogin;
  } catch {
    return null;
  }
}

async function writePendingLogin(pending: PendingLogin) {
  await mkdir(dirname(PENDING_LOGIN_PATH), { recursive: true, mode: 0o700 });
  await clearPendingLogin();
  await writeFile(PENDING_LOGIN_PATH, JSON.stringify(pending), { mode: 0o600 });
}

async function clearPendingLogin() {
  try {
    await unlink(PENDING_LOGIN_PATH);
    return true;
  } catch {
    return false;
  }
}

async function readSession(): Promise<SkillSession | null> {
  const raw = (await macKeychainRead()) ?? (await readFallbackSession());
  return raw ? (JSON.parse(raw) as SkillSession) : null;
}

async function writeSession(session: SkillSession) {
  const raw = JSON.stringify(session);
  if (!(await macKeychainWrite(raw))) {
    await writeFallbackSession(raw);
  }
}

async function clearSession() {
  const [keychain_cleared, fallback_cleared] = await Promise.all([
    macKeychainDelete(),
    clearFallbackSession(),
  ]);
  return {
    fallback_cleared,
    keychain_cleared,
    session_removed: keychain_cleared || fallback_cleared,
  };
}

async function refreshSession(session: SkillSession) {
  if (!session.refresh_token || !session.expires_at || session.expires_at > Date.now() + 60_000) {
    return session;
  }

  const tokenResponse = await fetch(`${AUTH_BASE}/oauth2/token`, {
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: session.refresh_token,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!tokenResponse.ok) {
    throw new Error("Skill Session refresh failed. Run `feedcontext login`.");
  }

  const token = (await tokenResponse.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    token_type?: string;
  };
  const nextSession = {
    access_token: token.access_token,
    expires_at: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
    refresh_token: token.refresh_token ?? session.refresh_token,
    token_type: "Bearer" as const,
  };
  await writeSession(nextSession);
  return nextSession;
}

async function openBrowser(url: string) {
  const command = platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

export function parsePairCode(pairCode: string) {
  if (!/^\d{6}$/.test(pairCode)) {
    throw new Error("Invalid pair code. Copy the 6-digit code from the FeedContext pair page.");
  }

  return pairCode;
}

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

export function parseConcurrency(value: string | number | undefined, defaultValue = 32) {
  if (value === undefined) return defaultValue;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }
  return parsed;
}

export function parsePositiveIntegerOption(input: {
  defaultValue?: number;
  max?: number;
  name: string;
  value?: string | number;
}) {
  if (input.value === undefined) return input.defaultValue;
  const parsed = typeof input.value === "number" ? input.value : Number.parseInt(input.value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${input.name} must be a positive integer.`);
  }
  if (input.max !== undefined && parsed > input.max) {
    throw new Error(`${input.name} must be less than or equal to ${input.max}.`);
  }
  return parsed;
}

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

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export function createSkillAuthUrl(state: string, challenge: string) {
  const authorize = new URL(`${API_ORIGIN}/v1/auth/skill`);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("state", state);
  return authorize;
}

async function startLogin() {
  const state = base64Url(randomBytes(24));
  const pkce = createPkce();
  const authorize = createSkillAuthUrl(state, pkce.challenge);
  await writePendingLogin({
    created_at: Date.now(),
    redirect_uri: REDIRECT_URI,
    state,
    verifier: pkce.verifier,
  });
  await openBrowser(authorize.toString());

  console.log(
    JSON.stringify({
      ok: true,
      authorize_url: authorize.toString(),
      next: "After signing in, copy the pair code from the browser and run `feedcontext login --pair-code <code>`.",
      status: "pair_code_required",
    }),
  );
}

async function completeLogin(pairCode: string) {
  const pending = await readPendingLogin();
  if (!pending) {
    throw new Error("No pending FeedContext login. Run `feedcontext login` first.");
  }

  if (pending.created_at < Date.now() - PENDING_LOGIN_TTL_MS) {
    await clearPendingLogin();
    throw new Error("Pending FeedContext login expired. Run `feedcontext login` again.");
  }

  const normalizedPairCode = parsePairCode(pairCode);
  const pairResponse = await fetch(`${API_ORIGIN}/v1/auth/pair/resolve`, {
    body: JSON.stringify({ pair_code: normalizedPairCode }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!pairResponse.ok) {
    throw new Error("Pair code expired or already used. Run `feedcontext login` again.");
  }

  const pair = (await pairResponse.json()) as {
    code: string;
    state: string;
  };

  if (pair.state !== pending.state) {
    throw new Error("Invalid pair code state. Run `feedcontext login` again.");
  }

  const tokenResponse = await fetch(`${AUTH_BASE}/oauth2/token`, {
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code: pair.code,
      code_verifier: pending.verifier,
      grant_type: "authorization_code",
      redirect_uri: pending.redirect_uri,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed with ${tokenResponse.status}`);
  }

  const token = (await tokenResponse.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    token_type?: string;
  };
  await writeSession({
    access_token: token.access_token,
    expires_at: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
    refresh_token: token.refresh_token,
    token_type: "Bearer",
  });
  await clearPendingLogin();
  console.log(JSON.stringify({ ok: true }));
}

async function login(options: { pairCode?: string }) {
  if (options.pairCode) {
    await completeLogin(options.pairCode);
    return;
  }

  await startLogin();
}

async function logout() {
  const session = await clearSession();
  const pending_login_cleared = await clearPendingLogin();
  console.log(
    JSON.stringify({
      ok: true,
      ...session,
      pending_login_cleared,
    }),
  );
}

async function getSession() {
  const storedSession = await readSession();
  if (!storedSession) {
    throw new Error("Not logged in. Run `feedcontext login`.");
  }
  return refreshSession(storedSession);
}

async function apiRequest(input: RawCall, session: SkillSession): Promise<ApiResult> {
  if (!isAllowedRawCall(input.method, input.path)) {
    throw new Error(`API path is not allowlisted: ${input.method.toUpperCase()} ${input.path}`);
  }
  enforceConfirmBeforeNetwork(input);

  const response = await fetch(`${API_ORIGIN}${input.path}`, {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
    },
    method: input.method.toUpperCase(),
  });

  if (response.status === 204) {
    return { ok: true, status: response.status, text: JSON.stringify({ ok: true }) };
  }

  const text = await response.text();
  return { ok: response.ok, status: response.status, text: text || "{}" };
}

async function apiCall(input: RawCall) {
  const result = await apiRequest(input, await getSession());
  process.stdout.write(result.text);
  if (!result.ok) {
    process.exitCode = 1;
  }
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
    );
  }
}

async function listAllItems(options: ListAllItemsOptions) {
  const limit = parsePositiveIntegerOption({
    defaultValue: 100,
    max: 100,
    name: "--limit",
    value: options.limit,
  });
  const maxPages = parsePositiveIntegerOption({
    defaultValue: 1000,
    name: "--max-pages",
    value: options.maxPages,
  });
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

async function importOpml(options: { concurrency?: string; confirm?: boolean; file: string }) {
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

async function printVersionStatus() {
  console.log(JSON.stringify(await getVersionStatus()));
}

async function main(argv = process.argv) {
  const program = new Command();
  program.name("feedcontext").description("FeedContext Skill helper");

  program.command("version").action(printVersionStatus);
  program
    .command("login")
    .option("--pair-code <code>")
    .action((options) => login({ pairCode: options.pairCode }));
  program.command("logout").action(logout);
  program
    .command("raw")
    .requiredOption("--method <method>")
    .requiredOption("--path <path>")
    .option("--body <json>")
    .option("--confirm")
    .action((options) =>
      apiCall({
        body: options.body ? JSON.parse(options.body) : undefined,
        confirm: options.confirm,
        method: options.method,
        path: options.path,
      }),
    );

  program
    .command("subscriptions:list")
    .action(() => apiCall({ method: "GET", path: "/v1/subscriptions" }));
  program
    .command("subscriptions:list-all")
    .action(() => apiCall({ method: "GET", path: "/v1/subscriptions" }));
  program
    .command("subscriptions:add")
    .requiredOption("--feed-url <url>")
    .option("--confirm")
    .action((options) =>
      apiCall({
        body: { feed_url: options.feedUrl },
        confirm: options.confirm,
        method: "POST",
        path: "/v1/subscriptions",
      }),
    );
  program
    .command("subscriptions:import-opml")
    .requiredOption("--file <path>")
    .option("--concurrency <count>", "Number of concurrent subscription creates", "32")
    .option("--confirm")
    .action((options) =>
      importOpml({
        concurrency: options.concurrency,
        confirm: options.confirm,
        file: options.file,
      }),
    );
  program
    .command("subscriptions:delete")
    .requiredOption("--id <id>")
    .option("--confirm")
    .action((options) =>
      apiCall({
        confirm: options.confirm,
        method: "DELETE",
        path: `/v1/subscriptions/${options.id}`,
      }),
    );
  program
    .command("items:list")
    .option("--subscription-id <id>")
    .option("--keyword <text>")
    .option("--published-after <timestamp>")
    .option("--published-before <timestamp>")
    .option("--limit <count>")
    .option("--cursor <cursor>")
    .option("--id <id>", "Filter to a Feed Item id; repeatable", (value, previous: string[]) => [
      ...(previous ?? []),
      value,
    ])
    .option("--search-content")
    .action((options) => {
      return apiCall({
        method: "GET",
        path: buildListItemsPath({ ...options, ids: options.id }),
      });
    });
  program
    .command("items:list-all")
    .option("--subscription-id <id>")
    .option("--keyword <text>")
    .option("--published-after <timestamp>")
    .option("--published-before <timestamp>")
    .option("--limit <count>", "Page size for each API request; defaults to 100")
    .option("--cursor <cursor>", "Start cursor")
    .option("--id <id>", "Filter to a Feed Item id; repeatable", (value, previous: string[]) => [
      ...(previous ?? []),
      value,
    ])
    .option("--search-content")
    .option("--max-pages <count>", "Safety cap for cursor traversal", "1000")
    .action((options) => {
      return listAllItems({ ...options, ids: options.id });
    });
  program
    .command("items:get")
    .requiredOption("--id <id>")
    .option("--cursor <cursor>", "Content continuation cursor")
    .option("--max-chars <count>", "Maximum content characters to read")
    .option("--include-raw")
    .action((options) => apiCall({ method: "GET", path: buildGetItemPath(options) }));

  await program.parseAsync(argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
