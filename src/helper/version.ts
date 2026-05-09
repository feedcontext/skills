import { execFile } from "node:child_process";
import { HELPER_DIR, SKILL_NAME, UPGRADE_COMMAND } from "./config";
import type { GitRunner, VersionStatus } from "./types";

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
