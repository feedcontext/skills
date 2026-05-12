#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { loadCase } from "./lib/case.mjs";
import { assertInside, evalsRoot, exists, readJson, repoRoot, writeJson } from "./lib/common.mjs";
import { checkContract } from "./check-contract.mjs";

const execFileAsync = promisify(execFile);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function gitStatus() {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1"], { cwd: repoRoot });
  return stdout.trim().split("\n").filter(Boolean).sort();
}

function formatCommand(command) {
  return command.args ? `${command.cmd} ${command.args.join(" ")}` : command.cmd;
}

async function runCommand(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      ...options,
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      ok: false,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function codexExecutionArgs({ outputDir, prompt, lastMessageFile, model, profile, resumeThreadId, useEphemeral }) {
  const args = [
    "--json",
    "--skip-git-repo-check",
    "-o",
    lastMessageFile,
  ];
  if (model) args.push("--model", model);
  if (resumeThreadId) {
    return ["exec", "resume", ...args, resumeThreadId, prompt];
  }
  if (profile) args.push("--profile", profile);
  return [
    "exec",
    ...args,
    ...(useEphemeral ? ["--ephemeral"] : []),
    "-C",
    outputDir,
    "-s",
    "workspace-write",
    prompt,
  ];
}

function parseThreadId(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started" && typeof event.thread_id === "string") {
        return event.thread_id;
      }
    } catch {
      // Ignore non-JSON lines from older CLIs.
    }
  }
  return null;
}

async function runCodex({ caseDef, outputDir, prompt, env, model, profile, turnIndex = null, resumeThreadId = null, useEphemeral = true }) {
  const suffix = turnIndex === null ? "codex" : `codex-turn-${String(turnIndex + 1).padStart(2, "0")}`;
  const lastMessageFile = join(outputDir, `${suffix}-last-message.md`);
  const eventsFile = join(outputDir, `${suffix}-events.jsonl`);
  const args = codexExecutionArgs({
    lastMessageFile,
    model,
    outputDir,
    profile,
    prompt,
    resumeThreadId,
    useEphemeral,
  });

  const startedAt = Date.now();
  const child = execFile("codex", args, {
    cwd: outputDir,
    env,
    timeout: caseDef.timeout_seconds * 1000,
    maxBuffer: 50 * 1024 * 1024,
  });

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin?.end();

  const exit = await new Promise((resolveExit) => {
    child.on("close", (code, signal) => resolveExit({ code, signal }));
    child.on("error", (error) => resolveExit({ code: 1, error: error.message }));
  });

  await writeFile(eventsFile, stdout);
  return {
    ...exit,
    duration_ms: Date.now() - startedAt,
    stderr,
    events_file: eventsFile,
    last_message_file: lastMessageFile,
    thread_id: resumeThreadId ?? parseThreadId(stdout),
    command: `codex ${args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}`,
  };
}

function renderEvalPrompt({ basePrompt, caseDef, outputDir, turn = null }) {
  const skillReadme = join(caseDef.skill_path, "SKILL.md");
  const helper = join(caseDef.skill_path, "scripts/helper.mjs");
  const fixtureLines = caseDef.fixture_paths.map((file) => `- ${file}`).join("\n");
  const turnPrefix = turn
    ? `\nThis is turn ${turn.index + 1} of ${turn.total} in a multi-turn FeedContext Skill eval.\nUser message for this turn:\n${turn.user}\n`
    : "";

  return `${turnPrefix}${basePrompt}

You are running a FeedContext Skill behavior eval as an independent agent.

Read the installable skill artifact from:
- ${skillReadme}

Use local fixtures:
${fixtureLines}

Write only inside this output directory:
- ${outputDir}

Strict rules:
- Treat the skill repository and installed skill artifact as read-only.
- Do not edit files outside the output directory.
- Do not call the live FeedContext API unless this eval explicitly asks for it.
- For live evals, use the FeedContext CLI with the provided FEEDCONTEXT_STATE_DIR; do not run login.
- Use this helper path for local-only validation if needed: ${helper}
- Run the helper version action before other FeedContext Skill actions.
- Record every shell command you run in ${join(outputDir, "command-trace.json")} with shape {"schema_version":"1","commands":[{"command":"..."}]}.
- Produce all files named by the prompt directly in the output directory.
- Finish with a concise status summary.
`;
}

function buildRunEnvironment(caseDef) {
  const env = { ...process.env };
  if (caseDef.lane !== "live") return env;
  const stateDir = process.env.FEEDCONTEXT_EVAL_STATE_DIR;
  if (!stateDir) {
    throw new Error("FEEDCONTEXT_EVAL_STATE_DIR is required for live evals.");
  }
  env.FEEDCONTEXT_STATE_DIR = stateDir;
  return env;
}

async function preflightLiveCase(caseDef, env) {
  if (caseDef.lane !== "live") return null;
  if (!caseDef.permissions.network || !caseDef.permissions.feedcontext_cli) {
    throw new Error("live evals must enable network and feedcontext_cli permissions.");
  }
  if (caseDef.account_policy !== "dedicated_eval_account_required") {
    throw new Error("live evals must require dedicated_eval_account_required.");
  }
  const cli = process.env.FEEDCONTEXT_CLI_BIN || "feedcontext";
  const status = await runCommand(cli, ["auth", "status"], { env });
  if (!status.ok) {
    throw new Error(
      `Live eval preflight failed: ${cli} auth status did not succeed with FEEDCONTEXT_EVAL_STATE_DIR. ${status.message ?? ""}\n${status.stderr}`.trim(),
    );
  }
  return {
    cli,
    stdout_preview: status.stdout.slice(0, 1000),
  };
}

async function loadTurns(caseDef) {
  if (!caseDef.turns_path) return null;
  const parsed = await readJson(caseDef.turns_path);
  if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) {
    throw new Error(`Invalid turns file ${caseDef.turns_path}: turns must be a non-empty array`);
  }
  return parsed.turns.map((turn, index) => {
    if (typeof turn.user !== "string" || turn.user.trim() === "") {
      throw new Error(`Invalid turns file ${caseDef.turns_path}: turns.${index}.user must be non-empty`);
    }
    return { user: turn.user };
  });
}

async function createFailurePacket({ caseDef, outputDir, run, report, beforeStatus, afterStatus }) {
  const packet = {
    schema_version: "1",
    case_id: caseDef.id,
    prompt_file: caseDef.prompt_path,
    output_dir: outputDir,
    trace_summary: {
      codex_exit_code: run.code,
      codex_signal: run.signal ?? null,
      duration_ms: run.duration_ms,
      events_file: run.events_file,
      last_message_file: run.last_message_file,
      stderr: run.stderr.slice(0, 4000),
    },
    failed_contract_checks: report?.checks?.filter((check) => !check.pass) ?? [],
    suggested_edit_surface: "review skill instructions, eval fixture, helper behavior, or expected contract",
    failure_classification: run.code === 0 ? "contract_failure" : "independent_agent_run_failure",
    git_status_changed: JSON.stringify(beforeStatus) !== JSON.stringify(afterStatus),
  };
  const packetFile = join(outputDir, "failure-packet.json");
  await writeJson(packetFile, packet);
  return packetFile;
}

export async function runOfflineCase({ caseDir, outputDir: requestedOutputDir, model = null, profile = null, matrixLabel = null } = {}) {
  const resolvedCaseDir = resolve(caseDir ?? join(evalsRoot, "cases/structured-synthesis-basic"));
  const caseDef = await loadCase(resolvedCaseDir);
  if (caseDef.permissions.skill_repo_write !== false) {
    throw new Error("skill_repo_write must be false");
  }

  const outputDir = resolve(
    requestedOutputDir ?? join(evalsRoot, "runs", caseDef.id, timestamp()),
  );
  assertInside(join(evalsRoot, "runs"), outputDir, "eval output directory");
  await mkdir(outputDir, { recursive: true });

  const beforeStatus = await gitStatus();
  const env = buildRunEnvironment(caseDef);
  const preflight = await preflightLiveCase(caseDef, env);
  const turns = await loadTurns(caseDef);
  const basePrompt = await readFile(caseDef.prompt_path, "utf8");
  const runOptions = { caseDef, env, model, outputDir, profile };
  let run;
  let turnRuns = null;
  if (turns) {
    turnRuns = [];
    let threadId = null;
    for (let index = 0; index < turns.length; index += 1) {
      const prompt = renderEvalPrompt({
        basePrompt,
        caseDef,
        outputDir,
        turn: { index, total: turns.length, user: turns[index].user },
      });
      await writeFile(join(outputDir, `prompt.turn-${String(index + 1).padStart(2, "0")}.full.md`), prompt);
      const turnRun = await runCodex({
        ...runOptions,
        prompt,
        resumeThreadId: threadId,
        turnIndex: index,
        useEphemeral: false,
      });
      turnRuns.push(turnRun);
      threadId = turnRun.thread_id ?? threadId;
      if (turnRun.code !== 0) break;
    }
    run = {
      code: turnRuns.every((turnRun) => turnRun.code === 0) ? 0 : 1,
      duration_ms: turnRuns.reduce((sum, turnRun) => sum + turnRun.duration_ms, 0),
      events_file: turnRuns.map((turnRun) => turnRun.events_file),
      last_message_file: turnRuns.at(-1)?.last_message_file ?? null,
      signal: turnRuns.find((turnRun) => turnRun.signal)?.signal ?? null,
      stderr: turnRuns.map((turnRun) => turnRun.stderr).join("\n"),
      thread_id: turnRuns.at(-1)?.thread_id ?? null,
      turns: turnRuns,
    };
  } else {
    const prompt = renderEvalPrompt({ basePrompt, caseDef, outputDir });
    await writeFile(join(outputDir, "prompt.full.md"), prompt);
    run = await runCodex({ ...runOptions, prompt });
  }
  const reportFile = join(outputDir, "contract-report.json");
  let report = null;
  let contractError = null;
  try {
    report = await checkContract({
      contractFile: caseDef.expected_contract_path,
      outputDir,
      reportFile,
    });
  } catch (error) {
    contractError = error instanceof Error ? error.message : String(error);
    report = {
      schema_version: "1",
      output_dir: outputDir,
      contract_file: caseDef.expected_contract_path,
      overall_pass: false,
      checks: [{ id: "contract_runner", pass: false, details: contractError }],
      file_summaries: [],
    };
    await writeJson(reportFile, report);
  }

  const afterStatus = await gitStatus();
  const gitChanged = JSON.stringify(beforeStatus) !== JSON.stringify(afterStatus);
  const success = run.code === 0 && report.overall_pass && !gitChanged;
  let failurePacketFile = null;
  if (!success) {
    failurePacketFile = await createFailurePacket({
      caseDef,
      outputDir,
      run,
      report,
      beforeStatus,
      afterStatus,
    });
  }

  const summary = {
    schema_version: "1",
    case_id: caseDef.id,
    lane: caseDef.lane,
    matrix_label: matrixLabel,
    model,
    profile,
    success,
    output_dir: outputDir,
    promptfoo_output: success ? "pass" : "fail",
    codex: run,
    preflight,
    turns: turnRuns,
    contract_report_file: reportFile,
    failure_packet_file: failurePacketFile,
    git_status_changed: gitChanged,
  };
  await writeJson(join(outputDir, "run-summary.json"), summary);
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const caseIndex = args.indexOf("--case");
  const outputIndex = args.indexOf("--output-dir");
  const modelIndex = args.indexOf("--model");
  const profileIndex = args.indexOf("--profile");
  const matrixIndex = args.indexOf("--matrix-label");
  const caseArg = caseIndex === -1 ? "structured-synthesis-basic" : args[caseIndex + 1];
  const caseDir = caseArg.includes("/") ? caseArg : join(evalsRoot, "cases", caseArg);
  const outputDir = outputIndex === -1 ? null : args[outputIndex + 1];
  const summary = await runOfflineCase({
    caseDir,
    matrixLabel: matrixIndex === -1 ? null : args[matrixIndex + 1],
    model: modelIndex === -1 ? null : args[modelIndex + 1],
    outputDir,
    profile: profileIndex === -1 ? null : args[profileIndex + 1],
  });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.success) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
