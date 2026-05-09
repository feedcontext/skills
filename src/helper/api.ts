import { API_ORIGIN, ALLOWLIST } from "./config";
import { getSession } from "./auth";
import type { ApiResult, RawCall, SkillSession } from "./types";

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

export async function apiRequest(input: RawCall, session: SkillSession): Promise<ApiResult> {
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

export async function apiCall(input: RawCall) {
  const result = await apiRequest(input, await getSession());
  process.stdout.write(result.text);
  if (!result.ok) {
    process.exitCode = 1;
  }
}
