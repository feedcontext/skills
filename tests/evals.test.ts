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
    expect(expectedContractSchema.properties.hard_gates.properties).toHaveProperty("schema_validations");
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

  it("checks a Structured Synthesis golden output contract", async () => {
    await mkdir(join("evals", "runs"), { recursive: true });
    const directory = await mkdtemp(join("evals", "runs", "test-contract-"));
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "briefing.synthesis.json"),
      JSON.stringify({
        schema_version: "1",
        scope: {
          request: "local self-verification for FeedContext Skill",
          selection_rule: "Group the fixture Feed Items by artifact workflow responsibility.",
          used_contextual_evidence: false,
        },
        units: [
          {
            id: "local-rendering",
            type: "insight",
            title: "Local artifacts stay repeatable",
            claim: "Reviewed Structured Synthesis can drive repeatable artifact definition bundles.",
            supporting_evidence: [
              {
                kind: "feed_item",
                feed_item_id: "item_local_renderers",
                url: "https://example.com/local-renderers",
                subscription_title: "FeedContext Engineering",
                title: "Local renderers make briefing pages repeatable",
                relevance: "direct",
                reason: "Directly describes deterministic local rendering.",
              },
            ],
            selection_rationale: "This is the shared base path for page generation.",
            rendering_priority: "lead",
          },
        ],
        secondary_items: [
          {
            feed_item_id: "item_eval_loop",
            url: "https://example.com/behavior-evals",
            title: "Behavior evals should replay independent agent runs",
            subscription_title: "Agent Quality Weekly",
            group: "supplemental",
            reason: "Relevant to the eval loop but not the lead artifact topic.",
          },
        ],
      }),
    );
    await writeFile(
      join(directory, "synthesis-review.json"),
      JSON.stringify({
        verdict: "ready",
        required_edits: [],
        ready_for_artifact: true,
      }),
    );
    await writeFile(
      join(directory, "command-trace.json"),
      JSON.stringify({
        schema_version: "1",
        commands: [
          { command: "node skills/feedcontext/scripts/helper.mjs version" },
          {
            command:
              "node skills/feedcontext/scripts/helper.mjs synthesis validate --file briefing.synthesis.json",
          },
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
