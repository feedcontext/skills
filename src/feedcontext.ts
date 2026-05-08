#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseOpml } from "feedsmith";
import WebSocket from "ws";
import allowlist from "@/allowlist.json" assert { type: "json" };
import showScriptSchema from "@/show-script.schema.json" assert { type: "json" };
import structuredSynthesisSchema from "@/structured-synthesis.schema.json" assert { type: "json" };

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

type ApiRequester = (input: RawCall, session: SkillSession) => Promise<ApiResult>;

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

type GatherInsightFileOptions = ListItemsOptions & {
  out: string;
};

type AudioProviderId = "bing-edge";

type AudioProviderDiagnostic = {
  available: boolean;
  default: boolean;
  id: AudioProviderId;
  label: string;
  notes: string[];
  privacy_boundary: string;
  provider_class: "production";
  reason?: string;
  setup_hint?: string;
  invocation?: {
    command: string;
    example_args: string[];
  };
};

type DetectAudioProvidersOptions = {
  provider?: AudioProviderId;
};

const DEFAULT_AUDIO_PROVIDER: AudioProviderId = "bing-edge";

type BingEdgeTtsOptions = {
  language?: string;
  out: string;
  textFile: string;
  voice?: string;
};

type BingEdgeTtsSegmentsOptions = {
  concurrency?: string;
  finalOut?: string;
  introAudio?: string;
  language?: string;
  outroAudio?: string;
  outDir: string;
  segmentsFile: string;
  voice?: string;
};

type BingEdgeTtsSegment = {
  id: string;
  speaker?: string;
  text: string;
  voice?: string;
};

type BingEdgeTtsSegmentsFile = {
  language?: string;
  segments: BingEdgeTtsSegment[];
};

type BingEdgeTtsSynthesizer = (options: {
  out: string;
  text: string;
  voice: string;
}) => Promise<void>;

type CommandRunner = (command: string, args: string[]) => Promise<void>;

type GetItemOptions = {
  cursor?: string;
  id: string;
  includeRaw?: boolean;
  maxChars?: string;
};

type JsonRecord = Record<string, unknown>;

type ListItemsResponse = {
  items: unknown[];
  next_cursor: string | null;
};

type GatherInsightItem = JsonRecord & {
  id?: unknown;
  summary?: unknown;
  summary_reviewed: true;
};

export type GatherInsightResult = {
  coverage: {
    pages: number;
    summary_reviewed_count: number;
    total: number;
  };
  items: GatherInsightItem[];
  schema_version: "1";
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
export const SKILL_PAIR_ENDPOINT = "/v1/auth/skill/pair";
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
    execFile("git", ["-C", cwd, ...args], { timeout: 10_000 }, (error, stdout) => {
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
}): number | undefined {
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
  const pairResponse = await fetch(`${API_ORIGIN}${SKILL_PAIR_ENDPOINT}`, {
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
      { cause: error },
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

function bingEdgeProviderDiagnostic(): AudioProviderDiagnostic {
  return {
    available: true,
    default: true,
    id: "bing-edge" as const,
    invocation: {
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
    },
    label: "Bing Edge TTS",
    notes: [
      "Uses the helper's built-in Edge Read Aloud client to access Microsoft Edge's online text-to-speech service.",
      "No API key, Python package, or external edge-tts CLI is required.",
    ],
    privacy_boundary:
      "The Show Script text needed for this Audio Brief is sent to Microsoft's Edge online text-to-speech service.",
    provider_class: "production" as const,
  };
}

export async function detectAudioProviders({
  provider,
}: DetectAudioProvidersOptions = {}) {
  const providers: AudioProviderDiagnostic[] = [];

  if (provider === undefined || provider === "bing-edge") {
    providers.push(bingEdgeProviderDiagnostic());
  }

  return { default_provider: DEFAULT_AUDIO_PROVIDER, providers };
}

async function printAudioProviderDoctor(options: { provider?: AudioProviderId }) {
  console.log(JSON.stringify(await detectAudioProviders({ provider: options.provider }), null, 2));
}

function escapeSsmlText(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function defaultBingEdgeVoiceForLanguage(language?: string) {
  return defaultBingEdgeVoiceForLanguageAndGender(language, "neutral");
}

function defaultBingEdgeVoiceForLanguageAndGender(language?: string, gender?: string) {
  const normalized = language?.trim().toLowerCase();
  const normalizedGender = gender === "male" || gender === "female" ? gender : "neutral";
  if (normalized?.startsWith("zh")) {
    return normalizedGender === "male" ? "zh-CN-YunxiNeural" : "zh-CN-XiaoxiaoNeural";
  }
  if (normalized?.startsWith("ja")) {
    return normalizedGender === "male" ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural";
  }
  if (normalized?.startsWith("ko")) {
    return normalizedGender === "male" ? "ko-KR-InJoonNeural" : "ko-KR-SunHiNeural";
  }
  if (normalized?.startsWith("es")) {
    return normalizedGender === "male" ? "es-ES-AlvaroNeural" : "es-ES-ElviraNeural";
  }
  if (normalized?.startsWith("fr")) {
    return normalizedGender === "male" ? "fr-FR-HenriNeural" : "fr-FR-DeniseNeural";
  }
  if (normalized?.startsWith("de")) {
    return normalizedGender === "male" ? "de-DE-ConradNeural" : "de-DE-KatjaNeural";
  }
  return normalizedGender === "male" ? "en-US-GuyNeural" : "en-US-AvaNeural";
}

function edgeTtsRequestId() {
  return randomBytes(16).toString("hex");
}

function edgeTtsSecMsGec() {
  const trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const roundedTicks = ticks - (ticks % 300);
  const windowsTicks = BigInt(roundedTicks) * 10_000_000n;
  return createHash("sha256")
    .update(`${windowsTicks}${trustedClientToken}`)
    .digest("hex")
    .toUpperCase();
}

function edgeTtsSpeechConfig() {
  return `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: "false",
            wordBoundaryEnabled: "false",
          },
          outputFormat: "audio-24khz-96kbitrate-mono-mp3",
        },
      },
    },
  })}`;
}

function edgeTtsSsml(voice: string, text: string) {
  const voiceLocale = /^[a-z]{2}-[A-Z]{2}/.exec(voice)?.[0] ?? "en-US";
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voiceLocale}">
  <voice name="${voice}">
    <prosody pitch="default" rate="default" volume="default">
      ${escapeSsmlText(text)}
    </prosody>
  </voice>
</speak>`;
}

async function synthesizeBingEdgeTtsFile({ out, text, voice }: {
  out: string;
  text: string;
  voice: string;
}) {
  const trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const connectionId = edgeTtsRequestId();
  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${trustedClientToken}` +
    `&Sec-MS-GEC=${edgeTtsSecMsGec()}` +
    `&Sec-MS-GEC-Version=1-143.0.3650.96` +
    `&ConnectionId=${connectionId}`;
  const requestId = edgeTtsRequestId();
  const writable = createWriteStream(out);
  let audioBytes = 0;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      },
    });
    let settled = false;

    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      ws.close();
      writable.destroy(error instanceof Error ? error : new Error(String(error)));
      reject(error instanceof Error ? error : new Error(String(error)));
    }

    function finish() {
      if (settled) return;
      settled = true;
      ws.close();
      writable.end(() => {
        if (audioBytes > 0) {
          resolve();
          return;
        }
        reject(new Error("No audio data received from Bing Edge TTS."));
      });
    }

    ws.once("open", () => {
      ws.send(edgeTtsSpeechConfig());
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${edgeTtsSsml(voice, text)}`,
      );
    });
    ws.once("error", fail);
    writable.once("error", fail);
    ws.on("message", (data) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const message = buffer.toString();
      if (message.includes("Path:turn.end")) {
        finish();
        return;
      }
      if (!message.includes("Path:audio")) return;

      const audioHeader = "Path:audio\r\n";
      const audioStart = buffer.indexOf(audioHeader) + audioHeader.length;
      if (audioStart < audioHeader.length) return;
      const audio = buffer.subarray(audioStart);
      audioBytes += audio.length;
      if (!writable.write(audio)) {
        ws.pause();
        writable.once("drain", () => ws.resume());
      }
    });
    ws.once("close", () => {
      if (!settled) finish();
    });
  });
}

async function defaultCommandRunner(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, { timeout: 120_000 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function concatAudioFiles(
  files: string[],
  out: string,
  run: CommandRunner = defaultCommandRunner,
) {
  if (files.length === 0) {
    throw new Error("Audio concat requires at least one input file.");
  }
  const listFile = `${out}.concat.txt`;
  const content = files
    .map((file) => `file '${file.replaceAll("'", "'\\''")}'`)
    .join("\n");
  await writeFile(listFile, `${content}\n`);
  try {
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      out,
    ]);
  } finally {
    await unlink(listFile).catch(() => undefined);
  }
}

export async function renderBingEdgeTts(
  options: BingEdgeTtsOptions,
  synthesize: BingEdgeTtsSynthesizer = synthesizeBingEdgeTtsFile,
) {
  const text = await readFile(options.textFile, "utf8");
  const voice = options.voice ?? defaultBingEdgeVoiceForLanguage(options.language);
  await synthesize({
    out: options.out,
    text,
    voice,
  });
  return {
    ok: true,
    out: options.out,
    provider: "bing-edge" as const,
    voice,
  };
}

function parseBingEdgeTtsSegments(value: unknown): BingEdgeTtsSegmentsFile {
  if (!isRecord(value) || !Array.isArray(value.segments)) {
    throw new Error("Segments file must contain a segments array.");
  }

  const language = value.language;
  if (language !== undefined && (typeof language !== "string" || language.trim() === "")) {
    throw new Error("language: must be a non-empty string when provided");
  }

  const segments = value.segments.map((segment, index) => {
    if (!isRecord(segment)) {
      throw new Error(`segments.${index}: must be an object`);
    }
    const id = segment.id;
    const speaker = segment.speaker;
    const text = segment.text;
    const voice = segment.voice;
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error(`segments.${index}.id: must be a non-empty string`);
    }
    if (speaker !== undefined && (typeof speaker !== "string" || speaker.trim() === "")) {
      throw new Error(`segments.${index}.speaker: must be a non-empty string when provided`);
    }
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error(`segments.${index}.text: must be a non-empty string`);
    }
    if (voice !== undefined && (typeof voice !== "string" || voice.trim() === "")) {
      throw new Error(`segments.${index}.voice: must be a non-empty string when provided`);
    }
    return { id, speaker, text, voice } satisfies BingEdgeTtsSegment;
  });

  return { language, segments };
}

function segmentFileName(index: number, segment: BingEdgeTtsSegment) {
  const ordinal = String(index + 1).padStart(3, "0");
  const slug = segment.id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${ordinal}-${slug || "segment"}.mp3`;
}

export async function renderBingEdgeTtsSegments(
  options: BingEdgeTtsSegmentsOptions,
  synthesize: BingEdgeTtsSynthesizer = synthesizeBingEdgeTtsFile,
  concat: typeof concatAudioFiles = concatAudioFiles,
) {
  const concurrency = parseConcurrency(options.concurrency, 4);
  const parsed = JSON.parse(await readFile(options.segmentsFile, "utf8")) as unknown;
  const parsedSegments = parseBingEdgeTtsSegments(parsed);
  const language = options.language ?? parsedSegments.language;
  const voice = options.voice ?? defaultBingEdgeVoiceForLanguage(language);
  const segments = parsedSegments.segments;
  await mkdir(options.outDir, { recursive: true });
  const rendered = await runWithConcurrency(segments, concurrency, async (segment, index) => {
    const mediaFile = join(options.outDir, segmentFileName(index, segment));
    await synthesize({
      out: mediaFile,
      text: segment.text,
      voice: segment.voice ?? voice,
    });
    return {
      id: segment.id,
      media_file: mediaFile,
      speaker: segment.speaker,
      voice: segment.voice ?? voice,
    };
  });

  if (options.finalOut) {
    await concat(
      [
        ...(options.introAudio ? [options.introAudio] : []),
        ...rendered.map((segment) => segment.media_file),
        ...(options.outroAudio ? [options.outroAudio] : []),
      ],
      options.finalOut,
    );
  }

  return {
    final_out: options.finalOut,
    ok: true,
    provider: "bing-edge" as const,
    segments: rendered,
    voice,
  };
}

function hostGender(host: JsonRecord, index: number, hostCount: number) {
  if (host.gender === "female" || host.gender === "male" || host.gender === "neutral") {
    return host.gender;
  }
  if (hostCount > 1) return index % 2 === 0 ? "female" : "male";
  return "neutral";
}

export function buildAudioSegmentsFromShowScript(showScript: unknown) {
  const errors = validateShowScript(showScript);
  if (errors.length > 0) {
    throw new Error(`Show Script is invalid: ${errors.join("; ")}`);
  }
  if (!isRecord(showScript)) {
    throw new Error("Show Script must be an object.");
  }

  const language = String(showScript.language);
  const hosts = showScript.hosts as JsonRecord[];
  const hostById = new Map<string, { gender: string; providerVoice?: string }>();
  hosts.forEach((host, index) => {
    hostById.set(String(host.id), {
      gender: hostGender(host, index, hosts.length),
      providerVoice: typeof host.provider_voice === "string" ? host.provider_voice : undefined,
    });
  });

  const segments: BingEdgeTtsSegment[] = [];
  (showScript.sections as JsonRecord[]).forEach((section) => {
    (section.turns as JsonRecord[]).forEach((turn, turnIndex) => {
      const speaker = String(turn.speaker);
      const host = hostById.get(speaker);
      const text = String(turn.text);
      segments.push({
        id: `${String(section.id)}-${String(turnIndex + 1).padStart(2, "0")}`,
        speaker,
        text,
        voice: host?.providerVoice ?? defaultBingEdgeVoiceForLanguageAndGender(language, host?.gender),
      });
    });
  });

  return {
    language,
    segments,
  };
}

async function writeAudioSegmentsFromShowScript(options: { out: string; scriptFile: string }) {
  const parsed = JSON.parse(await readFile(options.scriptFile, "utf8")) as unknown;
  const segments = buildAudioSegmentsFromShowScript(parsed);
  await writeFile(options.out, `${JSON.stringify(segments, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, out: options.out, segments: segments.segments.length }, null, 2));
}

async function renderAudio(options: {
  concurrency?: string;
  finalOut?: string;
  introAudio?: string;
  language?: string;
  out: string;
  outDir?: string;
  outroAudio?: string;
  provider?: AudioProviderId;
  segmentsFile?: string;
  textFile?: string;
  voice?: string;
}) {
  const provider = options.provider ?? DEFAULT_AUDIO_PROVIDER;
  if (provider !== "bing-edge") {
    throw new Error("Unsupported audio provider. Use --provider bing-edge.");
  }

  if (options.segmentsFile) {
    if (!options.outDir) {
      throw new Error("Segmented audio render requires --out-dir.");
    }
    const result = await renderBingEdgeTtsSegments({
      concurrency: options.concurrency,
      finalOut: options.finalOut,
      introAudio: options.introAudio,
      language: options.language,
      outroAudio: options.outroAudio,
      outDir: options.outDir,
      segmentsFile: options.segmentsFile,
      voice: options.voice,
    });
    await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!options.textFile) {
    throw new Error("Audio render requires --text-file unless --segments-file is provided.");
  }

  const result = await renderBingEdgeTts({
    language: options.language,
    out: options.out,
    textFile: options.textFile,
    voice: options.voice,
  });
  console.log(JSON.stringify(result, null, 2));
}

const evidenceRelevanceValues = new Set(["direct", "supporting", "background"]);
const synthesisUnitTypes = new Set(["insight", "item_roundup", "briefing_section"]);
const renderingPriorities = new Set(["lead", "main", "secondary", "collapsed"]);
const secondaryItemGroups = new Set(["supplemental", "low_information_gain", "out_of_scope"]);
const showScriptIntents = new Set([
  "script_only",
  "script_then_audio",
  "audio_from_existing_script",
]);
const showScriptFormats = new Set(["single_host", "two_host", "sectioned"]);
const audioOutputFormats = new Set(["mp3", "wav", "m4a"]);

function synthesisPathOf(path: string[]) {
  return path.length ? path.join(".") : "$";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireSynthesisRecord(
  value: unknown,
  path: string[],
  errors: string[],
): value is JsonRecord {
  if (!isRecord(value)) {
    errors.push(`${synthesisPathOf(path)}: must be an object`);
    return false;
  }
  return true;
}

function requireSynthesisString(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${synthesisPathOf([...path, key])}: must be a non-empty string`);
    return null;
  }
  return value;
}

function requireSynthesisEnum(
  record: JsonRecord,
  key: string,
  values: Set<string>,
  path: string[],
  errors: string[],
) {
  const value = requireSynthesisString(record, key, path, errors);
  if (value !== null && !values.has(value)) {
    errors.push(
      `${synthesisPathOf([...path, key])}: must be one of: ${Array.from(values).join(", ")}`,
    );
  }
}

function optionalSynthesisInteger(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    errors.push(`${synthesisPathOf([...path, key])}: must be an integer or null`);
  }
}

function optionalPositiveInteger(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 1)) {
    errors.push(`${synthesisPathOf([...path, key])}: must be a positive integer`);
  }
}

function optionalStringArray(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${synthesisPathOf([...path, key])}: must be an array`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      errors.push(`${synthesisPathOf([...path, key, String(index)])}: must be a non-empty string`);
    }
  });
}

function optionalBoolean(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value !== undefined && typeof value !== "boolean") {
    errors.push(`${synthesisPathOf([...path, key])}: must be a boolean`);
  }
}

function validateSynthesisEvidence(evidence: unknown, path: string[], errors: string[]) {
  if (!requireSynthesisRecord(evidence, path, errors)) return;

  const kind = evidence.kind;
  if (kind !== "feed_item" && kind !== "contextual" && kind !== "external_url") {
    errors.push(
      `${synthesisPathOf([...path, "kind"])}: must be feed_item, contextual, or external_url`,
    );
    return;
  }

  requireSynthesisEnum(evidence, "relevance", evidenceRelevanceValues, path, errors);
  requireSynthesisString(evidence, "reason", path, errors);

  if (kind === "feed_item") {
    requireSynthesisString(evidence, "feed_item_id", path, errors);
    requireSynthesisString(evidence, "url", path, errors);
    requireSynthesisString(evidence, "subscription_title", path, errors);
    requireSynthesisString(evidence, "title", path, errors);
    optionalSynthesisInteger(evidence, "published_at", path, errors);
    return;
  }

  if (kind === "contextual") {
    requireSynthesisString(evidence, "label", path, errors);
    return;
  }

  requireSynthesisString(evidence, "url", path, errors);
  requireSynthesisString(evidence, "title", path, errors);
}

function validateSynthesisUnit(unit: unknown, index: number, errors: string[]) {
  const path = ["units", String(index)];
  if (!requireSynthesisRecord(unit, path, errors)) return;

  requireSynthesisString(unit, "id", path, errors);
  requireSynthesisEnum(unit, "type", synthesisUnitTypes, path, errors);
  requireSynthesisString(unit, "title", path, errors);
  requireSynthesisString(unit, "claim", path, errors);
  requireSynthesisString(unit, "selection_rationale", path, errors);
  requireSynthesisEnum(unit, "rendering_priority", renderingPriorities, path, errors);

  if (!Array.isArray(unit.supporting_evidence) || unit.supporting_evidence.length === 0) {
    errors.push(`${synthesisPathOf([...path, "supporting_evidence"])}: must include at least one evidence item`);
    return;
  }

  unit.supporting_evidence.forEach((evidence, evidenceIndex) => {
    validateSynthesisEvidence(evidence, [
      ...path,
      "supporting_evidence",
      String(evidenceIndex),
    ], errors);
  });
}

function validateSynthesisSecondaryItem(item: unknown, index: number, errors: string[]) {
  const path = ["secondary_items", String(index)];
  if (!requireSynthesisRecord(item, path, errors)) return;

  requireSynthesisString(item, "feed_item_id", path, errors);
  requireSynthesisString(item, "url", path, errors);
  requireSynthesisString(item, "title", path, errors);
  requireSynthesisString(item, "subscription_title", path, errors);
  requireSynthesisEnum(item, "group", secondaryItemGroups, path, errors);
  requireSynthesisString(item, "reason", path, errors);
  optionalSynthesisInteger(item, "published_at", path, errors);
}

export function validateStructuredSynthesis(synthesis: unknown) {
  const errors: string[] = [];

  if (!requireSynthesisRecord(synthesis, [], errors)) return errors;

  if (synthesis.schema_version !== "1") {
    errors.push('schema_version: must be "1"');
  }

  if (requireSynthesisRecord(synthesis.scope, ["scope"], errors)) {
    requireSynthesisString(synthesis.scope, "request", ["scope"], errors);
    requireSynthesisString(synthesis.scope, "selection_rule", ["scope"], errors);

    for (const key of ["candidate_count", "active_subscription_count"]) {
      const value = synthesis.scope[key];
      if (
        value !== undefined &&
        (typeof value !== "number" || !Number.isInteger(value) || value < 0)
      ) {
        errors.push(`${synthesisPathOf(["scope", key])}: must be a non-negative integer`);
      }
    }

    if (
      synthesis.scope.used_contextual_evidence !== undefined &&
      typeof synthesis.scope.used_contextual_evidence !== "boolean"
    ) {
      errors.push("scope.used_contextual_evidence: must be a boolean");
    }
  }

  if (!Array.isArray(synthesis.units) || synthesis.units.length === 0) {
    errors.push("units: must include at least one synthesis unit");
  } else {
    synthesis.units.forEach((unit, index) => validateSynthesisUnit(unit, index, errors));
  }

  if (synthesis.secondary_items !== undefined) {
    if (!Array.isArray(synthesis.secondary_items)) {
      errors.push("secondary_items: must be an array");
    } else {
      synthesis.secondary_items.forEach((item, index) =>
        validateSynthesisSecondaryItem(item, index, errors),
      );
    }
  }

  return errors;
}

function validateShowHost(host: unknown, index: number, errors: string[]) {
  const path = ["hosts", String(index)];
  if (!requireSynthesisRecord(host, path, errors)) return;

  requireSynthesisString(host, "id", path, errors);
  requireSynthesisString(host, "name", path, errors);
  requireSynthesisString(host, "role", path, errors);
  if (host.voice !== undefined) {
    requireSynthesisString(host, "voice", path, errors);
  }
  if (host.gender !== undefined) {
    requireSynthesisEnum(host, "gender", new Set(["female", "male", "neutral"]), path, errors);
  }
  if (host.provider_voice !== undefined) {
    requireSynthesisString(host, "provider_voice", path, errors);
  }
}

function validateShowTurn(turn: unknown, sectionIndex: number, turnIndex: number, errors: string[]) {
  const path = ["sections", String(sectionIndex), "turns", String(turnIndex)];
  if (!requireSynthesisRecord(turn, path, errors)) return;

  requireSynthesisString(turn, "speaker", path, errors);
  requireSynthesisString(turn, "text", path, errors);
  optionalStringArray(turn, "synthesis_unit_ids", path, errors);
  optionalStringArray(turn, "evidence_ids", path, errors);
  if (turn.pacing !== undefined) {
    requireSynthesisString(turn, "pacing", path, errors);
  }
  if (turn.emotion !== undefined) {
    requireSynthesisString(turn, "emotion", path, errors);
  }
  if (turn.transition !== undefined) {
    requireSynthesisString(turn, "transition", path, errors);
  }
  if (turn.audio_notes !== undefined) {
    requireSynthesisString(turn, "audio_notes", path, errors);
  }
}

function validateShowSection(section: unknown, index: number, errors: string[]) {
  const path = ["sections", String(index)];
  if (!requireSynthesisRecord(section, path, errors)) return;

  requireSynthesisString(section, "id", path, errors);
  requireSynthesisString(section, "title", path, errors);
  optionalPositiveInteger(section, "target_duration_seconds", path, errors);
  optionalStringArray(section, "synthesis_unit_ids", path, errors);

  if (!Array.isArray(section.turns) || section.turns.length === 0) {
    errors.push(`${synthesisPathOf([...path, "turns"])}: must include at least one turn`);
    return;
  }
  section.turns.forEach((turn, turnIndex) => validateShowTurn(turn, index, turnIndex, errors));
}

function validatePronunciationNote(note: unknown, index: number, errors: string[]) {
  const path = ["pronunciation_notes", String(index)];
  if (!requireSynthesisRecord(note, path, errors)) return;

  requireSynthesisString(note, "term", path, errors);
  requireSynthesisString(note, "hint", path, errors);
}

function validateProviderRequirements(value: unknown, errors: string[]) {
  const path = ["provider_requirements"];
  if (!requireSynthesisRecord(value, path, errors)) return;

  optionalBoolean(value, "multi_voice", path, errors);
  optionalBoolean(value, "long_form", path, errors);
  optionalBoolean(value, "segment_generation", path, errors);
  for (const key of ["multi_voice", "long_form", "segment_generation"]) {
    if (value[key] === undefined) {
      errors.push(`${synthesisPathOf([...path, key])}: must be a boolean`);
    }
  }
  if (value.preferred_output_format !== undefined) {
    requireSynthesisEnum(value, "preferred_output_format", audioOutputFormats, path, errors);
  }
}

export function validateShowScript(showScript: unknown) {
  const errors: string[] = [];

  if (!requireSynthesisRecord(showScript, [], errors)) return errors;

  if (showScript.schema_version !== "1") {
    errors.push('schema_version: must be "1"');
  }

  if (requireSynthesisRecord(showScript.source_synthesis, ["source_synthesis"], errors)) {
    requireSynthesisString(showScript.source_synthesis, "file", ["source_synthesis"], errors);
    if (showScript.source_synthesis.id !== undefined) {
      requireSynthesisString(showScript.source_synthesis, "id", ["source_synthesis"], errors);
    }
  }

  requireSynthesisEnum(showScript, "intent", showScriptIntents, [], errors);
  requireSynthesisEnum(showScript, "format", showScriptFormats, [], errors);
  requireSynthesisString(showScript, "language", [], errors);
  requireSynthesisString(showScript, "title", [], errors);
  if (showScript.listening_context !== undefined) {
    requireSynthesisString(showScript, "listening_context", [], errors);
  }
  optionalPositiveInteger(showScript, "target_duration_seconds", [], errors);

  if (!Array.isArray(showScript.hosts) || showScript.hosts.length === 0) {
    errors.push("hosts: must include at least one host");
  } else {
    showScript.hosts.forEach((host, index) => validateShowHost(host, index, errors));
  }

  if (!Array.isArray(showScript.sections) || showScript.sections.length === 0) {
    errors.push("sections: must include at least one section");
  } else {
    showScript.sections.forEach((section, index) => validateShowSection(section, index, errors));
  }

  if (showScript.pronunciation_notes !== undefined) {
    if (!Array.isArray(showScript.pronunciation_notes)) {
      errors.push("pronunciation_notes: must be an array");
    } else {
      showScript.pronunciation_notes.forEach((note, index) =>
        validatePronunciationNote(note, index, errors),
      );
    }
  }

  validateProviderRequirements(showScript.provider_requirements, errors);

  return errors;
}

async function validateSynthesisFile(file: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read or parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const errors = validateStructuredSynthesis(parsed);
  if (errors.length > 0) {
    console.error(`Structured synthesis validation failed for ${file}:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Structured synthesis is valid: ${file}`);
}

function printSynthesisSchema() {
  console.log(JSON.stringify(structuredSynthesisSchema, null, 2));
}

async function validateShowScriptFile(file: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read or parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const errors = validateShowScript(parsed);
  if (errors.length > 0) {
    console.error(`Show Script validation failed for ${file}:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Show Script is valid: ${file}`);
}

function printShowScriptSchema() {
  console.log(JSON.stringify(showScriptSchema, null, 2));
}

async function main(argv = process.argv) {
  const program = new Command();
  program.name("feedcontext").description("FeedContext Skill helper");

  program
    .command("version")
    .description("Print installed revision, latest revision, and upgrade status")
    .action(printVersionStatus);
  program
    .command("login")
    .description("Start browser login or finish login with a pair code")
    .option("--pair-code <code>", "Resolve a pending browser login with the 6-digit pair code")
    .action((options) => login({ pairCode: options.pairCode }));
  program
    .command("logout")
    .description("Clear the local Skill Session and pending login state")
    .action(logout);
  program
    .command("raw")
    .description("Call an allowlisted public API path directly")
    .requiredOption("--method <method>", "HTTP method for the allowlisted API request")
    .requiredOption("--path <path>", "Allowlisted API path, including query string when needed")
    .option("--body <json>", "JSON request body for allowlisted write requests")
    .option("--confirm", "Confirm host approval for a mutating request before network access")
    .action((options) =>
      apiCall({
        body: options.body ? JSON.parse(options.body) : undefined,
        confirm: options.confirm,
        method: options.method,
        path: options.path,
      }),
    );

  const subscription = program.command("subscription").description("Read and manage Subscriptions");
  subscription
    .command("list")
    .description("List all visible Subscriptions")
    .action(() => apiCall({ method: "GET", path: "/v1/subscriptions" }));
  subscription
    .command("add")
    .description("Create a Subscription from an RSS or Atom feed URL")
    .requiredOption("--feed-url <url>", "RSS or Atom feed URL to subscribe to")
    .option("--confirm", "Confirm host approval before creating the Subscription")
    .action((options) =>
      apiCall({
        body: { feed_url: options.feedUrl },
        confirm: options.confirm,
        method: "POST",
        path: "/v1/subscriptions",
      }),
    );
  subscription
    .command("import-opml")
    .description("Import Subscriptions from an OPML file")
    .requiredOption("--file <path>", "OPML file to parse for RSS or Atom feed URLs")
    .option("--concurrency <count>", "Number of concurrent subscription creates", "32")
    .option("--confirm", "Confirm host approval before creating Subscriptions")
    .action((options) =>
      importOpml({
        concurrency: options.concurrency,
        confirm: options.confirm,
        file: options.file,
      }),
    );
  subscription
    .command("delete")
    .description("Delete a Subscription by id")
    .requiredOption("--id <id>", "Subscription id to delete")
    .option("--confirm", "Confirm host approval before deleting the Subscription")
    .action((options) =>
      apiCall({
        confirm: options.confirm,
        method: "DELETE",
        path: `/v1/subscriptions/${options.id}`,
      }),
    );

  const item = program.command("item").description("Discover and read Feed Items");
  item
    .command("list")
    .description("List Feed Item discovery metadata")
    .option("--subscription-id <id>", "Filter Feed Items to one Subscription id")
    .option("--keyword <text>", "Search Feed Item discovery metadata")
    .option("--published-after <timestamp>", "Only include Feed Items published after this epoch millisecond timestamp")
    .option("--published-before <timestamp>", "Only include Feed Items published before this epoch millisecond timestamp")
    .option("--limit <count>", "Page size for Feed Item listing, up to 100")
    .option("--cursor <cursor>", "Opaque list pagination cursor to continue from")
    .option("--id <id>", "Filter to a Feed Item id; repeatable", (value, previous: string[]) => [
      ...(previous ?? []),
      value,
    ])
    .option("--search-content", "Search Feed Item content as well as discovery metadata")
    .option("--all", "Follow pagination and return all matching Feed Items")
    .option("--max-pages <count>", "Safety cap for --all pagination", "1000")
    .action((options) => {
      if (options.all) {
        return listAllItems({ ...options, ids: options.id });
      }

      return apiCall({
        method: "GET",
        path: buildListItemsPath({ ...options, ids: options.id }),
      });
    });
  item
    .command("get")
    .description("Read one Feed Item content chunk")
    .requiredOption("--id <id>", "Feed Item id to read")
    .option("--cursor <cursor>", "Content continuation cursor")
    .option("--max-chars <count>", "Maximum content characters to read")
    .option("--include-raw", "Include raw content and Feed Item metadata for debugging or recovery")
    .action((options) => apiCall({ method: "GET", path: buildGetItemPath(options) }));

  const insight = program.command("insight").description("Compose Feed Item aggregation sidecars");
  insight
    .command("gather")
    .description("Gather in-scope Feed Item summaries into a local Gather Sidecar")
    .option("--published-after <timestamp>", "Only include Feed Items published after this epoch millisecond timestamp")
    .option("--published-before <timestamp>", "Only include Feed Items published before this epoch millisecond timestamp")
    .requiredOption("--out <path>", "Path to write the Gather Sidecar JSON")
    .action(async (options) => {
      const gather = await writeGatherInsightFile(options, await getSession());
      console.log(
        JSON.stringify(
          {
            ok: true,
            out: options.out,
            ...gather.coverage,
          },
          null,
          2,
        ),
      );
    });

  const synthesis = program.command("synthesis").description("Validate Structured Synthesis files");
  synthesis
    .command("validate")
    .description("Validate a Structured Synthesis JSON file")
    .requiredOption("--file <path>", "Structured Synthesis JSON file to validate")
    .action((options) => validateSynthesisFile(options.file));
  synthesis
    .command("schema")
    .description("Print the FeedContext Structured Synthesis JSON Schema")
    .action(printSynthesisSchema);

  const showScript = program.command("show-script").description("Validate Show Script files");
  showScript
    .command("validate")
    .description("Validate a Show Script JSON file")
    .requiredOption("--file <path>", "Show Script JSON file to validate")
    .action((options) => validateShowScriptFile(options.file));
  showScript
    .command("schema")
    .description("Print the FeedContext Show Script JSON Schema")
    .action(printShowScriptSchema);

  const audio = program.command("audio").description("Inspect Audio Brief provider paths");
  const audioProvider = audio.command("provider").description("Inspect audio providers");
  audioProvider
    .command("doctor")
    .description("Report configured Audio Brief provider availability")
    .option("--provider <provider>", "Provider id to inspect, such as bing-edge")
    .action((options) => printAudioProviderDoctor({ provider: options.provider }));
  audio
    .command("segments")
    .description("Convert a Show Script JSON file into speaker-aware TTS segments")
    .requiredOption("--script-file <path>", "Show Script JSON file to convert")
    .requiredOption("--out <path>", "Path to write the TTS segments JSON")
    .action((options) => writeAudioSegmentsFromShowScript(options));
  audio
    .command("render")
    .description("Render spoken text through an Audio Brief provider")
    .option("--provider <provider>", "Provider id to use; defaults to bing-edge")
    .option("--text-file <path>", "Plain text file to synthesize")
    .option("--segments-file <path>", "JSON file with ordered text segments to synthesize")
    .option("--out-dir <path>", "Output directory for segmented audio files")
    .option("--concurrency <count>", "Number of TTS segments to render concurrently", "4")
    .requiredOption("--out <path>", "Output audio file path, or segment manifest path with --segments-file")
    .option("--final-out <path>", "Optional final audio file assembled from rendered segments")
    .option("--intro-audio <path>", "Optional intro music/audio file to prepend when --final-out is used")
    .option("--outro-audio <path>", "Optional outro music/audio file to append when --final-out is used")
    .option("--language <bcp47>", "Spoken language for provider voice selection, such as zh-CN or en-US")
    .option("--voice <voice>", "Provider voice id")
    .action((options) => renderAudio(options));

  await program.parseAsync(argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
