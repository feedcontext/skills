import { execFile, spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { platform } from "node:os";
import { API_ORIGIN, AUTH_BASE, CLIENT_ID, FALLBACK_PATH, PENDING_LOGIN_PATH, PENDING_LOGIN_TTL_MS, REDIRECT_URI, SERVICE, ACCOUNT, SKILL_PAIR_ENDPOINT } from "./config";
import type { PendingLogin, SkillSession } from "./types";

function base64Url(input: Buffer) {
  return input.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { challenge, verifier };
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

export async function login(options: { pairCode?: string }) {
  if (options.pairCode) {
    await completeLogin(options.pairCode);
    return;
  }

  await startLogin();
}

export async function logout() {
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

export async function getSession() {
  const storedSession = await readSession();
  if (!storedSession) {
    throw new Error("Not logged in. Run `feedcontext login`.");
  }
  return refreshSession(storedSession);
}
