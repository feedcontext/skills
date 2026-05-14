#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  assertInside,
  exists,
  fileSize,
  jsonPathValue,
  matchesExpected,
  readJson,
  repoRoot,
  resolveFrom,
  writeJson,
} from "./lib/common.mjs";

const execFileAsync = promisify(execFile);

function validateExpectedContract(contract) {
  const errors = [];
  if (typeof contract !== "object" || contract === null || Array.isArray(contract)) {
    return ["contract must be a JSON object"];
  }
  if (contract.schema_version !== "1") errors.push('schema_version must be "1"');
  if (typeof contract.hard_gates !== "object" || contract.hard_gates === null) {
    errors.push("hard_gates must be an object");
  }
  return errors;
}

async function helperValidate(schema, file) {
  const helper = join(repoRoot, "skills/feedcontext/scripts/helper.mjs");
  const args =
    schema === "structured-synthesis"
      ? ["synthesis", "validate", "--file", file]
      : ["show-script", "validate", "--file", file];
  await execFileAsync("node", [helper, ...args], { cwd: repoRoot });
}

function result(id, pass, details = "") {
  return { id, pass, details };
}

async function checkRequiredFiles(outputDir, files) {
  const results = [];
  for (const file of files ?? []) {
    const target = resolveFrom(outputDir, file);
    assertInside(outputDir, target, "required file");
    const present = await exists(target);
    results.push(result(`required_files:${file}`, present, present ? "" : "missing"));
  }
  return results;
}

async function checkSchemaValidations(outputDir, validations) {
  const results = [];
  for (const validation of validations ?? []) {
    const target = resolveFrom(outputDir, validation.file);
    assertInside(outputDir, target, "schema validation file");
    try {
      await helperValidate(validation.schema, target);
      results.push(result(`schema_validations:${validation.file}:${validation.schema}`, true));
    } catch (error) {
      results.push(
        result(
          `schema_validations:${validation.file}:${validation.schema}`,
          false,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }
  return results;
}

async function checkReviewVerdicts(outputDir, verdicts) {
  const results = [];
  for (const review of verdicts ?? []) {
    const target = resolveFrom(outputDir, review.file);
    assertInside(outputDir, target, "review verdict file");
    try {
      const parsed = await readJson(target);
      const actual = parsed.verdict;
      results.push(
        result(
          `review_verdicts:${review.file}`,
          actual === review.verdict,
          actual === review.verdict ? "" : `expected ${review.verdict}, got ${String(actual)}`,
        ),
      );
    } catch (error) {
      results.push(
        result(`review_verdicts:${review.file}`, false, error instanceof Error ? error.message : String(error)),
      );
    }
  }
  return results;
}

async function checkCommandOrder(outputDir, commandOrder) {
  if (!commandOrder || commandOrder.length === 0) return [];
  const traceFile = join(outputDir, "command-trace.json");
  try {
    const trace = await readJson(traceFile);
    const commands = Array.isArray(trace.commands)
      ? trace.commands.map((command) => String(command.command ?? command))
      : [];
    let cursor = 0;
    for (const expected of commandOrder) {
      const found = commands.findIndex((command, index) => index >= cursor && command.includes(expected));
      if (found === -1) {
        return [
          result(
            "command_order",
            false,
            `missing command after index ${cursor}: ${expected}; saw ${commands.join(" | ")}`,
          ),
        ];
      }
      cursor = found + 1;
    }
    return [result("command_order", true)];
  } catch (error) {
    return [result("command_order", false, error instanceof Error ? error.message : String(error))];
  }
}

async function checkHtml(outputDir, checks) {
  const results = [];
  for (const check of checks ?? []) {
    const target = resolveFrom(outputDir, check.file);
    assertInside(outputDir, target, "html check file");
    const html = await readFile(target, "utf8");
    for (const needle of check.contains ?? []) {
      results.push(
        result(
          `html_checks:${check.file}:${needle}`,
          html.includes(needle),
          html.includes(needle) ? "" : "missing expected content",
        ),
      );
    }
    for (const structure of check.structures ?? []) {
      results.push(checkHtmlStructure(check.file, html, structure));
    }
  }
  return results;
}

function sectionHtml(html, mode) {
  const startPattern = new RegExp(`<section\\b[^>]*data-mode-content="${mode}"[^>]*>`, "u");
  const startMatch = startPattern.exec(html);
  if (!startMatch) return "";
  const startIndex = startMatch.index;
  const nextModeMatch = new RegExp(`<section\\b[^>]*data-mode-content="(?!${mode}")`, "u").exec(
    html.slice(startIndex + startMatch[0].length),
  );
  const endIndex = nextModeMatch
    ? startIndex + startMatch[0].length + nextModeMatch.index
    : html.indexOf('<section class="source-index"', startIndex);
  return html.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function hasExternalLink(fragment) {
  return /<a\b[^>]*href="https?:\/\//u.test(fragment);
}

function checkHtmlStructure(file, html, structure) {
  if (structure === "dual_document_formats") {
    const pass = html.includes('data-mode-content="newspaper"') &&
      html.includes('data-document-format="magazine"') &&
      html.includes('data-mode-content="narrative"') &&
      html.includes('data-document-format="longform"');
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected magazine and longform document-format markers on the two mode sections",
    );
  }

  if (structure === "light_dark_modes") {
    const pass = html.includes("color-scheme: light dark") &&
      /@media\s*\(prefers-color-scheme:\s*dark\)/u.test(html) &&
      /--paper:\s*#[0-9a-fA-F]{3,6}/u.test(html) &&
      /--ink:\s*#[0-9a-fA-F]{3,6}/u.test(html);
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected color-scheme declaration, dark media query, and core light/dark variables",
    );
  }

  if (structure === "source_index_links") {
    const sourceIndex = html.match(/<section class="source-index"[\s\S]*?<\/section>/u)?.[0] ?? "";
    const pass = hasExternalLink(sourceIndex);
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected external source links in the shared footer source index",
    );
  }

  if (structure === "no_inline_source_controls") {
    const newspaper = sectionHtml(html, "newspaper");
    const narrative = sectionHtml(html, "narrative");
    const pass = !newspaper.includes('class="source-cluster"') &&
      !newspaper.includes('class="source-chip"') &&
      !newspaper.includes('class="source-tooltip"') &&
      !newspaper.includes('class="source-mark"') &&
      !narrative.includes('class="inline-citation"') &&
      !narrative.includes('class="citation-tooltip"') &&
      !narrative.includes("Supported by");
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected body sections to avoid inline source controls; source links belong in rich-text DSL or footer index",
    );
  }

  if (structure === "generated_masthead_title") {
    const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/u)?.[1] ?? "";
    const pass = h1.length > 0 && !/读取|总结|生成|页面给我|Summarize all|Create .*page/iu.test(h1);
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected masthead h1 to be an editorial briefing title, not the raw user request",
    );
  }

  if (structure === "narrative_no_article_rules") {
    const pass = /\.narrative-prose article\s*\{[\s\S]*?border-top:\s*0/u.test(html) &&
      /\.narrative-prose article\s*\{[\s\S]*?padding-top:\s*0/u.test(html);
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected narrative paragraphs to flow without article separator rules",
    );
  }

  if (structure === "stable_masthead_layout") {
    const pass = html.includes("grid-template-areas:") &&
      html.includes('"kicker title"') &&
      html.includes('"deck title"') &&
      html.includes('"meta meta"') &&
      html.includes('"toggle toggle"') &&
      /h1\s*\{[\s\S]*?font-size:\s*clamp\([^;]*58px\)/u.test(html);
    return result(
      `html_checks:${file}:structure:${structure}`,
      pass,
      pass ? "" : "expected explicit masthead grid areas and a bounded title font size",
    );
  }

  return result(`html_checks:${file}:structure:${structure}`, false, "unknown html structure check");
}

async function checkJsonPaths(outputDir, checks) {
  const results = [];
  for (const check of checks ?? []) {
    const target = resolveFrom(outputDir, check.file);
    assertInside(outputDir, target, "json path check file");
    const parsed = await readJson(target);
    const actual = jsonPathValue(parsed, check.path);
    const pass = matchesExpected(actual, check.expected);
    results.push(
      result(
        `json_path_checks:${check.file}:${check.path}`,
        pass,
        pass ? "" : `expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(actual)}`,
      ),
    );
  }
  return results;
}

async function checkForbiddenPatterns(outputDir, patterns) {
  if (!patterns || patterns.length === 0) return [];
  const defaultOutputFiles = [
    "briefing.synthesis.json",
    "synthesis-review.json",
    "show-script.json",
    "script-review.json",
    "segments.json",
    "auth-plan.json",
    "api-boundary-plan.json",
    "feed-items-plan.json",
    "subscriptions-plan.json",
    "integrations-plan.json",
    "migration-plan.json",
    "troubleshooting-plan.json",
    "subscriptions.snapshot.json",
    "feed-items.snapshot.json",
    "turn-1-summary.json",
    "command-trace.json",
  ];
  const results = [];
  for (const entry of patterns) {
    const pattern = typeof entry === "string" ? entry : entry.pattern;
    const outputFiles = typeof entry === "string" ? defaultOutputFiles : [entry.file];
    const regex = new RegExp(pattern, "u");
    let matched = false;
    for (const file of outputFiles) {
      const target = join(outputDir, file);
      if (!(await exists(target))) continue;
      const text = await readFile(target, "utf8");
      if (regex.test(text)) {
        matched = true;
        break;
      }
    }
    results.push(result(`forbidden_patterns:${pattern}`, !matched, matched ? "pattern matched" : ""));
  }
  return results;
}

async function checkArtifactBoundaries(outputDir, boundaries) {
  const results = [];
  for (const boundary of boundaries ?? []) {
    if (boundary === "only_case_output_writes") {
      const isRunOutput = outputDir.includes(`${resolve(repoRoot, "evals/runs")}`);
      const isReferenceOutput = outputDir.includes(`${resolve(repoRoot, "evals/cases")}`) &&
        outputDir.endsWith("reference-output");
      results.push(result(`artifact_boundaries:${boundary}`, isRunOutput || isReferenceOutput));
      continue;
    }
    if (boundary === "no_skill_repo_writes" || boundary === "no_install_artifact_pollution") {
      results.push(result(`artifact_boundaries:${boundary}`, true, "enforced by runner sandbox and git diff validation"));
      continue;
    }
    results.push(result(`artifact_boundaries:${boundary}`, true));
  }
  return results;
}

export async function checkContract({ contractFile, outputDir, reportFile }) {
  const contract = await readJson(contractFile);
  const validationErrors = validateExpectedContract(contract);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid expected contract ${contractFile}:\n- ${validationErrors.join("\n- ")}`);
  }

  const gates = contract.hard_gates;
  const checks = [
    ...(await checkRequiredFiles(outputDir, gates.required_files)),
    ...(await checkSchemaValidations(outputDir, gates.schema_validations)),
    ...(await checkReviewVerdicts(outputDir, gates.review_verdicts)),
    ...(await checkCommandOrder(outputDir, gates.command_order)),
    ...(await checkHtml(outputDir, gates.html_checks)),
    ...(await checkJsonPaths(outputDir, gates.json_path_checks)),
    ...(await checkForbiddenPatterns(outputDir, gates.forbidden_patterns)),
    ...(await checkArtifactBoundaries(outputDir, gates.artifact_boundaries)),
  ];

  const fileSummaries = [];
  for (const file of gates.required_files ?? []) {
    const target = resolveFrom(outputDir, file);
    if (await exists(target)) {
      fileSummaries.push({ file, bytes: await fileSize(target) });
    }
  }

  const report = {
    schema_version: "1",
    output_dir: outputDir,
    contract_file: contractFile,
    overall_pass: checks.every((check) => check.pass),
    checks,
    file_summaries: fileSummaries,
  };

  if (reportFile) {
    await mkdir(dirname(reportFile), { recursive: true });
    await writeJson(reportFile, report);
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const contractIndex = args.indexOf("--contract");
  const outputIndex = args.indexOf("--output-dir");
  const reportIndex = args.indexOf("--report");
  if (contractIndex === -1 || outputIndex === -1) {
    throw new Error("Usage: node evals/check-contract.mjs --contract <file> --output-dir <dir> [--report <file>]");
  }
  const report = await checkContract({
    contractFile: resolve(args[contractIndex + 1]),
    outputDir: resolve(args[outputIndex + 1]),
    reportFile: reportIndex === -1 ? null : resolve(args[reportIndex + 1]),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.overall_pass) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
