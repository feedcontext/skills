#!/usr/bin/env node
import {readFile} from "node:fs/promises";

const [, , file] = process.argv;

if (!file) {
  console.error("Usage: node scripts/validate-synthesis.mjs <synthesis.json>");
  process.exit(2);
}

const relevanceValues = new Set(["direct", "supporting", "background"]);
const unitTypes = new Set(["insight", "item_roundup", "briefing_section"]);
const priorities = new Set(["lead", "main", "secondary", "collapsed"]);
const secondaryGroups = new Set([
  "supplemental",
  "low_information_gain",
  "out_of_scope",
]);

const errors = [];

function pathOf(path) {
  return path.length ? path.join(".") : "$";
}

function fail(path, message) {
  errors.push(`${pathOf(path)}: ${message}`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value, path) {
  if (!isRecord(value)) {
    fail(path, "must be an object");
    return false;
  }
  return true;
}

function requireString(record, key, path) {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    fail([...path, key], "must be a non-empty string");
    return null;
  }
  return value;
}

function requireEnum(record, key, values, path) {
  const value = requireString(record, key, path);
  if (value !== null && !values.has(value)) {
    fail([...path, key], `must be one of: ${Array.from(values).join(", ")}`);
  }
}

function optionalInteger(record, key, path) {
  const value = record[key];
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    fail([...path, key], "must be an integer or null");
  }
}

function validateEvidence(evidence, path) {
  if (!requireRecord(evidence, path)) return;

  const kind = evidence.kind;
  if (kind !== "feed_item" && kind !== "contextual" && kind !== "external_url") {
    fail([...path, "kind"], "must be feed_item, contextual, or external_url");
    return;
  }

  requireEnum(evidence, "relevance", relevanceValues, path);
  requireString(evidence, "reason", path);

  if (kind === "feed_item") {
    requireString(evidence, "feed_item_id", path);
    requireString(evidence, "url", path);
    requireString(evidence, "subscription_title", path);
    requireString(evidence, "title", path);
    optionalInteger(evidence, "published_at", path);
    return;
  }

  if (kind === "contextual") {
    requireString(evidence, "label", path);
    return;
  }

  requireString(evidence, "url", path);
  requireString(evidence, "title", path);
}

function validateUnit(unit, index) {
  const path = ["units", String(index)];
  if (!requireRecord(unit, path)) return;

  requireString(unit, "id", path);
  requireEnum(unit, "type", unitTypes, path);
  requireString(unit, "title", path);
  requireString(unit, "claim", path);
  requireString(unit, "selection_rationale", path);
  requireEnum(unit, "rendering_priority", priorities, path);

  if (!Array.isArray(unit.supporting_evidence) || unit.supporting_evidence.length === 0) {
    fail([...path, "supporting_evidence"], "must include at least one evidence item");
    return;
  }

  unit.supporting_evidence.forEach((evidence, evidenceIndex) => {
    validateEvidence(evidence, [
      ...path,
      "supporting_evidence",
      String(evidenceIndex),
    ]);
  });
}

function validateSecondaryItem(item, index) {
  const path = ["secondary_items", String(index)];
  if (!requireRecord(item, path)) return;

  requireString(item, "feed_item_id", path);
  requireString(item, "url", path);
  requireString(item, "title", path);
  requireString(item, "subscription_title", path);
  requireEnum(item, "group", secondaryGroups, path);
  requireString(item, "reason", path);
  optionalInteger(item, "published_at", path);
}

function validateSynthesis(synthesis) {
  if (!requireRecord(synthesis, [])) return;

  if (synthesis.schema_version !== "1") {
    fail(["schema_version"], 'must be "1"');
  }

  if (requireRecord(synthesis.scope, ["scope"])) {
    requireString(synthesis.scope, "request", ["scope"]);
    requireString(synthesis.scope, "selection_rule", ["scope"]);

    for (const key of ["candidate_count", "active_subscription_count"]) {
      const value = synthesis.scope[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        fail(["scope", key], "must be a non-negative integer");
      }
    }

    if (
      synthesis.scope.used_contextual_evidence !== undefined &&
      typeof synthesis.scope.used_contextual_evidence !== "boolean"
    ) {
      fail(["scope", "used_contextual_evidence"], "must be a boolean");
    }
  }

  if (!Array.isArray(synthesis.units) || synthesis.units.length === 0) {
    fail(["units"], "must include at least one synthesis unit");
  } else {
    synthesis.units.forEach(validateUnit);
  }

  if (synthesis.secondary_items !== undefined) {
    if (!Array.isArray(synthesis.secondary_items)) {
      fail(["secondary_items"], "must be an array");
    } else {
      synthesis.secondary_items.forEach(validateSecondaryItem);
    }
  }
}

let parsed;
try {
  parsed = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Could not read or parse ${file}: ${error.message}`);
  process.exit(1);
}

validateSynthesis(parsed);

if (errors.length) {
  console.error(`Structured synthesis validation failed for ${file}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Structured synthesis is valid: ${file}`);
