export type JsonRecord = Record<string, unknown>;

export type GitRunner = (args: string[], cwd: string) => Promise<string>;

export type VersionStatus = {
  name: string;
  installed_revision: string | null;
  latest_revision: string | null;
  upgrade_available: boolean;
  upgrade_check_error?: string;
  upgrade_command: string;
};
