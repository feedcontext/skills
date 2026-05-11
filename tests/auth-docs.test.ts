import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readDoc(path: string) {
  return readFileSync(path, "utf8");
}

describe("FeedContext Skill auth documentation", () => {
  it("routes unauthenticated skill work through anonymous auth before formal login", () => {
    const root = readDoc("skills/feedcontext/SKILL.md");
    const auth = readDoc("skills/feedcontext/actions/auth.md");
    const troubleshooting = readDoc("skills/feedcontext/actions/troubleshooting.md");

    expect(root).toContain("feedcontext auth status");
    expect(root).toContain("feedcontext auth anonymous");
    expect(root).toContain("feedcontext auth logout");
    expect(auth).toContain("feedcontext auth status");
    expect(auth).toContain("feedcontext auth anonymous");
    expect(auth).toContain("feedcontext auth login");
    expect(auth).toContain("feedcontext auth logout");
    expect(auth).toContain("100 active Subscriptions");
    expect(auth).toContain("merge");
    expect(troubleshooting).toContain("feedcontext auth logout");
    expect(troubleshooting).toContain("feedcontext auth login");
  });

  it("does not document obsolete top-level login or logout commands", () => {
    const docs = [
      "skills/feedcontext/SKILL.md",
      "skills/feedcontext/actions/auth.md",
      "skills/feedcontext/actions/troubleshooting.md",
    ].map((path) => readDoc(path).replaceAll("feedcontext auth login", "").replaceAll("feedcontext auth logout", ""));

    for (const doc of docs) {
      expect(doc).not.toContain("feedcontext login");
      expect(doc).not.toContain("feedcontext logout");
    }
  });
});
