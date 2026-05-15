import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import caseSchema from "../evals/schemas/case.schema.json" assert { type: "json" };
import expectedContractSchema from "../evals/schemas/expected-contract.schema.json" assert { type: "json" };

const execFileAsync = promisify(execFile);

describe("FeedContext Skill behavior eval contracts", () => {
  it("defines strict case permission defaults", () => {
    expect(caseSchema.properties.permissions.properties.skill_repo_write).toMatchObject({
      const: false,
    });
    expect(caseSchema.properties.permissions.properties.output_write).toMatchObject({
      const: true,
    });
    expect(caseSchema.properties.permissions.required).toContain("feedcontext_cli");
  });

  it("keeps deterministic expected contract gates separate from rubric grading", () => {
    expect(expectedContractSchema.required).toEqual(["schema_version", "hard_gates"]);
    expect(expectedContractSchema.properties.hard_gates.properties).toHaveProperty("required_files");
    expect(expectedContractSchema.properties.hard_gates.properties).toHaveProperty("json_path_checks");
    expect(expectedContractSchema.properties.hard_gates.properties).toHaveProperty("artifact_boundaries");
    expect(expectedContractSchema.properties).toHaveProperty("rubric");
  });

  it("supports multi-turn case manifests without making turns part of the behavior contract", () => {
    expect(caseSchema.required).not.toContain("prompt_file");
    expect(caseSchema.properties).toHaveProperty("turns_file");
    expect(caseSchema.anyOf).toEqual([{ required: ["prompt_file"] }, { required: ["turns_file"] }]);
  });

  it("fails live cases fast when the eval state dir is missing", async () => {
    await expect(
      execFileAsync("node", ["evals/run-offline.mjs", "--case", "live-short-subscriptions"], {
        env: { ...process.env, FEEDCONTEXT_EVAL_STATE_DIR: "" },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("FEEDCONTEXT_EVAL_STATE_DIR is required for live evals."),
    });
  });

  it("checks an Artifact Composition Request golden output contract", async () => {
    await mkdir(join("evals", "runs"), { recursive: true });
    const directory = await mkdtemp(join("evals", "runs", "test-contract-"));
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "composition-request.json"),
      JSON.stringify({
        artifact_type: "briefing_page",
        user_request: "local self-verification for FeedContext Skill",
        language: "zh-CN",
        scope: {
          item_ids: ["item_local_renderers"],
          query: "artifact workflow responsibility",
        },
        capacity: {
          target_topics: 2,
        },
        user_preference_context: {
          notes: ["keep it concise"],
        },
      }),
    );
    await writeFile(
      join(directory, "command-trace.json"),
      JSON.stringify({
        schema_version: "1",
        commands: [
          { command: "node skills/feedcontext/scripts/helper.mjs version" },
          { command: "feedcontext auth status" },
          { command: "feedcontext artifact compose --artifact-type briefing_page --request \"local self-verification for FeedContext Skill\" --item-id item_local_renderers --target-topics 2 --confirm" },
        ],
      }),
    );

    const reportFile = join(directory, "contract-report.json");
    const { stdout } = await execFileAsync("node", [
      "evals/check-contract.mjs",
      "--contract",
      "evals/cases/structured-synthesis-basic/expected.contract.json",
      "--output-dir",
      directory,
      "--report",
      reportFile,
    ]);

    const report = JSON.parse(await readFile(reportFile, "utf8"));
    expect(JSON.parse(stdout)).toMatchObject({ overall_pass: true });
    expect(report).toMatchObject({ overall_pass: true });
  });
});
