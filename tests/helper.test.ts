import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { buildVersionStatus } from "@/feedcontext";

const execFileAsync = promisify(execFile);

async function runHelper(args: string[]) {
  return execFileAsync("node", ["skills/feedcontext/scripts/helper.mjs", ...args], {
    cwd: new URL("..", import.meta.url),
    env: process.env,
  });
}

describe("FeedContext Skill local helper command surface", () => {
  it("keeps generation, schema, validation, and service interaction commands out of the packed helper", async () => {
    const { stdout } = await runHelper(["--help"]);

    expect(stdout).toContain("version");
    for (const command of [
      "synthesis",
      "show-script",
      "sizing",
      "schema",
      "validate",
      "login",
      "logout",
      "raw",
      "subscription",
      "item",
      "insight",
      "integration",
      "audio",
      "artifact",
    ]) {
      expect(stdout).not.toContain(command);
    }
  });
});

describe("FeedContext Skill helper version action", () => {
  it("reports upgrade availability when revisions differ", () => {
    expect(
      buildVersionStatus({
        installedRevision: "abc123",
        latestRevision: "def456",
      }),
    ).toMatchObject({
      installed_revision: "abc123",
      latest_revision: "def456",
      name: "feedcontext",
      upgrade_available: true,
    });
  });

  it("does not report upgrades when latest revision is unknown", () => {
    expect(
      buildVersionStatus({
        installedRevision: "abc123",
        latestRevision: null,
        upgradeCheckError: "latest_revision_unavailable",
      }),
    ).toMatchObject({
      latest_revision: null,
      upgrade_available: false,
      upgrade_check_error: "latest_revision_unavailable",
    });
  });
});
