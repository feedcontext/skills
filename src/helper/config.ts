import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const HELPER_DIR = dirname(fileURLToPath(import.meta.url));
export const SKILL_NAME = "feedcontext";
export const UPGRADE_COMMAND = "npx skills update feedcontext";
