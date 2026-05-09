import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import allowlist from "@/allowlist.json" assert { type: "json" };
import type { AudioProviderId } from "./types";

export const API_ORIGIN = process.env.FEEDCONTEXT_API_ORIGIN ?? "https://api.feedcontext.io";
export const WEB_ORIGIN = process.env.FEEDCONTEXT_WEB_ORIGIN ?? "https://feedcontext.io";
export const AUTH_BASE = `${API_ORIGIN}/api/auth`;
export const SKILL_PAIR_ENDPOINT = "/v1/auth/skill/pair";
export const CLIENT_ID = "feedcontext-skill";
export const REDIRECT_URI = `${WEB_ORIGIN}/pair`;
export const SCOPES = "feeds:read subscriptions:read subscriptions:write";

export const SERVICE = "feedcontext.skill";
export const ACCOUNT = "default";
export const FALLBACK_PATH = join(homedir(), ".feedcontext", "skill-session.json");
export const PENDING_LOGIN_PATH = join(homedir(), ".feedcontext", "pending-login.json");
export const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;
export const ALLOWLIST = allowlist.paths;
export const HELPER_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_INTRO_AUDIO = join(HELPER_DIR, "..", "assets", "audio", "intro.mp3");
export const DEFAULT_OUTRO_AUDIO = join(HELPER_DIR, "..", "assets", "audio", "outro.mp3");
export const SKILL_NAME = "feedcontext";
export const UPGRADE_COMMAND = "npx skills update feedcontext";
export const DEFAULT_AUDIO_PROVIDER: AudioProviderId = "bing-edge";
