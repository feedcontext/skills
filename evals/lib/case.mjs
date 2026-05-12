import { join } from "node:path";
import { readJson, resolveFrom } from "./common.mjs";

function requireString(record, key, errors) {
  if (typeof record[key] !== "string" || record[key].trim() === "") {
    errors.push(`${key} must be a non-empty string`);
  }
}

function requireBoolean(record, key, errors) {
  if (typeof record[key] !== "boolean") {
    errors.push(`permissions.${key} must be a boolean`);
  }
}

export async function loadCase(caseDir) {
  const manifestFile = join(caseDir, "case.json");
  const manifest = await readJson(manifestFile);
  const errors = validateCaseManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid case manifest ${manifestFile}:\n- ${errors.join("\n- ")}`);
  }

  if (manifest.permissions.network && manifest.account_policy !== "dedicated_eval_account_required") {
    throw new Error(
      `Invalid case manifest ${manifestFile}: network-enabled cases must require dedicated_eval_account_required`,
    );
  }

  return {
    ...manifest,
    case_dir: caseDir,
    manifest_file: manifestFile,
    skill_path: resolveFrom(caseDir, manifest.skill),
    prompt_path: manifest.prompt_file ? resolveFrom(caseDir, manifest.prompt_file) : null,
    turns_path: manifest.turns_file ? resolveFrom(caseDir, manifest.turns_file) : null,
    fixture_paths: manifest.fixture_files.map((file) => resolveFrom(caseDir, file)),
    expected_contract_path: resolveFrom(caseDir, manifest.expected_contract_file),
  };
}

export function validateCaseManifest(manifest) {
  const errors = [];
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return ["case manifest must be a JSON object"];
  }

  if (manifest.schema_version !== "1") errors.push('schema_version must be "1"');
  requireString(manifest, "id", errors);
  if (manifest.lane !== "offline" && manifest.lane !== "live") {
    errors.push("lane must be offline or live");
  }
  requireString(manifest, "skill", errors);
  if (manifest.prompt_file !== undefined) requireString(manifest, "prompt_file", errors);
  if (manifest.turns_file !== undefined) requireString(manifest, "turns_file", errors);
  if (!manifest.prompt_file && !manifest.turns_file) {
    errors.push("one of prompt_file or turns_file must be present");
  }
  requireString(manifest, "expected_contract_file", errors);
  if (!Number.isInteger(manifest.timeout_seconds) || manifest.timeout_seconds < 1) {
    errors.push("timeout_seconds must be a positive integer");
  }
  if (
    manifest.account_policy !== "none" &&
    manifest.account_policy !== "dedicated_eval_account_required"
  ) {
    errors.push("account_policy must be none or dedicated_eval_account_required");
  }
  if (!Array.isArray(manifest.fixture_files)) {
    errors.push("fixture_files must be an array");
  } else {
    manifest.fixture_files.forEach((file, index) => {
      if (typeof file !== "string" || file.trim() === "") {
        errors.push(`fixture_files.${index} must be a non-empty string`);
      }
    });
  }

  const permissions = manifest.permissions;
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    errors.push("permissions must be an object");
    return errors;
  }

  for (const key of ["shell", "network", "feedcontext_cli", "skill_repo_write", "output_write"]) {
    requireBoolean(permissions, key, errors);
  }
  if (permissions.skill_repo_write !== false) {
    errors.push("permissions.skill_repo_write must always be false");
  }
  if (permissions.output_write !== true) {
    errors.push("permissions.output_write must be true");
  }

  return errors;
}
