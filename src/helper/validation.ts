import { readFile } from "node:fs/promises";
import Ajv2020, { type AnySchema, type ErrorObject } from "ajv/dist/2020";
import type { JsonRecord } from "./types";

const evidenceRelevanceValues = new Set(["direct", "supporting", "background"]);
const synthesisUnitTypes = new Set(["insight", "item_roundup", "briefing_section"]);
const renderingPriorities = new Set(["lead", "main", "secondary", "collapsed"]);
const secondaryItemGroups = new Set(["supplemental", "low_information_gain", "out_of_scope"]);
const showScriptIntents = new Set([
  "script_only",
  "script_then_audio",
  "audio_from_existing_script",
]);
const showScriptFormats = new Set(["single_host", "two_host", "sectioned"]);
const audioOutputFormats = new Set(["mp3", "wav", "m4a"]);
const artifactTypes = new Set(["briefing_page", "audio_brief"]);
const artifactSizingLanguages = new Set(["cjk", "latin"]);
const artifactSizingMedia = new Set(["newspaper", "podcast"]);

type ArtifactSizingLanguage = "cjk" | "latin";
type SynthesisUnitType = "insight" | "item_roundup" | "briefing_section";
type RenderingPriority = "lead" | "main" | "secondary" | "collapsed";

type LengthRange = {
  cjk: [number, number];
  latin: [number, number];
};

const newspaperRanges: Record<RenderingPriority, Partial<Record<SynthesisUnitType, LengthRange>>> =
  {
    lead: {
      insight: { cjk: [800, 1500], latin: [450, 800] },
      item_roundup: { cjk: [600, 1200], latin: [350, 650] },
      briefing_section: { cjk: [600, 1200], latin: [350, 650] },
    },
    main: {
      insight: { cjk: [500, 900], latin: [280, 500] },
      item_roundup: { cjk: [350, 700], latin: [200, 400] },
      briefing_section: { cjk: [350, 700], latin: [200, 400] },
    },
    secondary: {
      insight: { cjk: [180, 350], latin: [100, 220] },
      item_roundup: { cjk: [180, 350], latin: [100, 220] },
      briefing_section: { cjk: [180, 350], latin: [100, 220] },
    },
    collapsed: {
      insight: { cjk: [40, 120], latin: [25, 80] },
      item_roundup: { cjk: [40, 120], latin: [25, 80] },
      briefing_section: { cjk: [40, 120], latin: [25, 80] },
    },
  };

const podcastDurationRanges: Record<RenderingPriority, [number, number]> = {
  lead: [120, 300],
  main: [60, 180],
  secondary: [30, 90],
  collapsed: [10, 30],
};

const spokenRateRanges: Record<ArtifactSizingLanguage, [number, number]> = {
  cjk: [220, 320],
  latin: [130, 160],
};

const canonicalSchemaPaths = {
  artifactSizing: "/schemas/artifact-sizing-review.v1.schema.json",
  showScript: "/schemas/show-script.v1.schema.json",
  structuredSynthesis: "/schemas/structured-synthesis.v1.schema.json",
} as const;

function schemaBaseUrl() {
  return process.env.FEEDCONTEXT_SCHEMA_BASE_URL ?? "https://api.feedcontext.io";
}

async function fetchCanonicalSchema(path: string) {
  const response = await fetch(new URL(path, schemaBaseUrl()));
  if (!response.ok) {
    throw new Error(`Could not fetch canonical schema ${path}: HTTP ${response.status}`);
  }
  return await response.json();
}

function formatJsonSchemaError(error: ErrorObject) {
  const path = error.instancePath ? error.instancePath.replaceAll("/", ".").replace(/^\./, "") : "$";
  return `${path}: ${error.message ?? "does not match schema"}`;
}

function validateWithJsonSchema(schema: unknown, value: unknown) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as AnySchema);
  if (validate(value)) {
    return [];
  }
  return (validate.errors ?? []).map(formatJsonSchemaError);
}

function synthesisPathOf(path: string[]) {
  return path.length ? path.join(".") : "$";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireSynthesisRecord(
  value: unknown,
  path: string[],
  errors: string[],
): value is JsonRecord {
  if (!isRecord(value)) {
    errors.push(`${synthesisPathOf(path)}: must be an object`);
    return false;
  }
  return true;
}

function requireSynthesisString(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${synthesisPathOf([...path, key])}: must be a non-empty string`);
    return null;
  }
  return value;
}

function requireSynthesisEnum(
  record: JsonRecord,
  key: string,
  values: Set<string>,
  path: string[],
  errors: string[],
) {
  const value = requireSynthesisString(record, key, path, errors);
  if (value !== null && !values.has(value)) {
    errors.push(
      `${synthesisPathOf([...path, key])}: must be one of: ${Array.from(values).join(", ")}`,
    );
  }
}

function optionalSynthesisInteger(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    errors.push(`${synthesisPathOf([...path, key])}: must be an integer or null`);
  }
}

function optionalPositiveInteger(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 1)) {
    errors.push(`${synthesisPathOf([...path, key])}: must be a positive integer`);
  }
}

function optionalStringArray(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${synthesisPathOf([...path, key])}: must be an array`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      errors.push(`${synthesisPathOf([...path, key, String(index)])}: must be a non-empty string`);
    }
  });
}

function optionalBoolean(record: JsonRecord, key: string, path: string[], errors: string[]) {
  const value = record[key];
  if (value !== undefined && typeof value !== "boolean") {
    errors.push(`${synthesisPathOf([...path, key])}: must be a boolean`);
  }
}

function countTextUnits(text: string, language: ArtifactSizingLanguage) {
  if (language === "cjk") {
    return Array.from(text.replace(/\s+/g, "")).length;
  }
  return text.trim().split(/[\s\u2014-]+/u).filter(Boolean).length;
}

function asSynthesisUnitType(value: string): SynthesisUnitType | null {
  return synthesisUnitTypes.has(value) ? (value as SynthesisUnitType) : null;
}

function asRenderingPriority(value: string): RenderingPriority | null {
  return renderingPriorities.has(value) ? (value as RenderingPriority) : null;
}

function validateNewspaperSizingUnit(
  unit: JsonRecord,
  path: string[],
  language: ArtifactSizingLanguage,
  errors: string[],
) {
  const text = requireSynthesisString(unit, "text", path, errors);
  const type = typeof unit.type === "string" ? asSynthesisUnitType(unit.type) : null;
  const priority =
    typeof unit.rendering_priority === "string"
      ? asRenderingPriority(unit.rendering_priority)
      : null;

  if (text === null || type === null || priority === null) return;

  const range = newspaperRanges[priority][type]?.[language];
  if (!range) {
    errors.push(`${synthesisPathOf(path)}: has no newspaper sizing range`);
    return;
  }

  const count = countTextUnits(text, language);
  const [minimum, maximum] = range;
  if (count < minimum || count > maximum) {
    const unitName = language === "cjk" ? "characters" : "words";
    errors.push(
      `${synthesisPathOf([...path, "text"])}: ${count} ${unitName} does not fit ${priority}/${type} newspaper range ${minimum}-${maximum}`,
    );
  }
}

function validatePodcastSizingUnit(
  unit: JsonRecord,
  path: string[],
  language: ArtifactSizingLanguage,
  errors: string[],
) {
  const priority =
    typeof unit.rendering_priority === "string"
      ? asRenderingPriority(unit.rendering_priority)
      : null;
  if (priority === null) return;

  const duration = unit.target_duration_seconds;
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 1) {
    errors.push(`${synthesisPathOf([...path, "target_duration_seconds"])}: must be a positive integer`);
    return;
  }

  const [minimum, maximum] = podcastDurationRanges[priority];
  if (duration < minimum || duration > maximum) {
    errors.push(
      `${synthesisPathOf([...path, "target_duration_seconds"])}: ${duration}s does not fit ${priority} podcast range ${minimum}-${maximum}s`,
    );
  }

  if (typeof unit.text === "string" && unit.text.trim() !== "") {
    const count = countTextUnits(unit.text, language);
    const wordsPerMinute = count / (duration / 60);
    const [minimumRate, maximumRate] = spokenRateRanges[language];
    if (wordsPerMinute < minimumRate || wordsPerMinute > maximumRate) {
      const unitName = language === "cjk" ? "characters" : "words";
      errors.push(
        `${synthesisPathOf([...path, "text"])}: ${Math.round(wordsPerMinute)} ${unitName}/minute does not fit ${minimumRate}-${maximumRate} ${unitName}/minute spoken range`,
      );
    }
  }
}

function validateSynthesisEvidence(evidence: unknown, path: string[], errors: string[]) {
  if (!requireSynthesisRecord(evidence, path, errors)) return;

  const kind = evidence.kind;
  if (kind !== "feed_item" && kind !== "contextual" && kind !== "external_url") {
    errors.push(
      `${synthesisPathOf([...path, "kind"])}: must be feed_item, contextual, or external_url`,
    );
    return;
  }

  requireSynthesisEnum(evidence, "relevance", evidenceRelevanceValues, path, errors);
  requireSynthesisString(evidence, "reason", path, errors);

  if (kind === "feed_item") {
    requireSynthesisString(evidence, "feed_item_id", path, errors);
    requireSynthesisString(evidence, "url", path, errors);
    requireSynthesisString(evidence, "subscription_title", path, errors);
    requireSynthesisString(evidence, "title", path, errors);
    optionalSynthesisInteger(evidence, "published_at", path, errors);
    return;
  }

  if (kind === "contextual") {
    requireSynthesisString(evidence, "label", path, errors);
    return;
  }

  requireSynthesisString(evidence, "url", path, errors);
  requireSynthesisString(evidence, "title", path, errors);
}

function validateSynthesisUnit(unit: unknown, index: number, errors: string[]) {
  const path = ["units", String(index)];
  if (!requireSynthesisRecord(unit, path, errors)) return;

  requireSynthesisString(unit, "id", path, errors);
  requireSynthesisEnum(unit, "type", synthesisUnitTypes, path, errors);
  requireSynthesisString(unit, "title", path, errors);
  requireSynthesisString(unit, "claim", path, errors);
  requireSynthesisString(unit, "selection_rationale", path, errors);
  requireSynthesisEnum(unit, "rendering_priority", renderingPriorities, path, errors);

  if (!Array.isArray(unit.supporting_evidence) || unit.supporting_evidence.length === 0) {
    errors.push(`${synthesisPathOf([...path, "supporting_evidence"])}: must include at least one evidence item`);
    return;
  }

  unit.supporting_evidence.forEach((evidence, evidenceIndex) => {
    validateSynthesisEvidence(evidence, [
      ...path,
      "supporting_evidence",
      String(evidenceIndex),
    ], errors);
  });
}

function validateSynthesisSecondaryItem(item: unknown, index: number, errors: string[]) {
  const path = ["secondary_items", String(index)];
  if (!requireSynthesisRecord(item, path, errors)) return;

  requireSynthesisString(item, "feed_item_id", path, errors);
  requireSynthesisString(item, "url", path, errors);
  requireSynthesisString(item, "title", path, errors);
  requireSynthesisString(item, "subscription_title", path, errors);
  requireSynthesisEnum(item, "group", secondaryItemGroups, path, errors);
  requireSynthesisString(item, "reason", path, errors);
  optionalSynthesisInteger(item, "published_at", path, errors);
}

export function validateStructuredSynthesis(synthesis: unknown) {
  const errors: string[] = [];

  if (!requireSynthesisRecord(synthesis, [], errors)) return errors;

  if (synthesis.schema_version !== "1") {
    errors.push('schema_version: must be "1"');
  }

  if (requireSynthesisRecord(synthesis.scope, ["scope"], errors)) {
    requireSynthesisString(synthesis.scope, "request", ["scope"], errors);
    requireSynthesisString(synthesis.scope, "selection_rule", ["scope"], errors);

    for (const key of ["candidate_count", "active_subscription_count"]) {
      const value = synthesis.scope[key];
      if (
        value !== undefined &&
        (typeof value !== "number" || !Number.isInteger(value) || value < 0)
      ) {
        errors.push(`${synthesisPathOf(["scope", key])}: must be a non-negative integer`);
      }
    }

    if (
      synthesis.scope.used_contextual_evidence !== undefined &&
      typeof synthesis.scope.used_contextual_evidence !== "boolean"
    ) {
      errors.push("scope.used_contextual_evidence: must be a boolean");
    }
  }

  if (!Array.isArray(synthesis.units) || synthesis.units.length === 0) {
    errors.push("units: must include at least one synthesis unit");
  } else {
    synthesis.units.forEach((unit, index) => validateSynthesisUnit(unit, index, errors));
  }

  if (synthesis.secondary_items !== undefined) {
    if (!Array.isArray(synthesis.secondary_items)) {
      errors.push("secondary_items: must be an array");
    } else {
      synthesis.secondary_items.forEach((item, index) =>
        validateSynthesisSecondaryItem(item, index, errors),
      );
    }
  }

  return errors;
}

function validateShowHost(host: unknown, index: number, errors: string[]) {
  const path = ["hosts", String(index)];
  if (!requireSynthesisRecord(host, path, errors)) return;

  requireSynthesisString(host, "id", path, errors);
  if (host.name !== undefined) {
    requireSynthesisString(host, "name", path, errors);
  }
  requireSynthesisString(host, "role", path, errors);
  if (host.voice !== undefined) {
    requireSynthesisString(host, "voice", path, errors);
  }
  if (host.gender !== undefined) {
    requireSynthesisEnum(host, "gender", new Set(["female", "male", "neutral"]), path, errors);
  }
  if (host.provider_voice !== undefined) {
    requireSynthesisString(host, "provider_voice", path, errors);
  }
  if (host.voice_persona_id !== undefined) {
    requireSynthesisString(host, "voice_persona_id", path, errors);
  }
}

function validateShowTurn(turn: unknown, sectionIndex: number, turnIndex: number, errors: string[]) {
  const path = ["sections", String(sectionIndex), "turns", String(turnIndex)];
  if (!requireSynthesisRecord(turn, path, errors)) return;

  requireSynthesisString(turn, "speaker", path, errors);
  requireSynthesisString(turn, "text", path, errors);
  optionalStringArray(turn, "synthesis_unit_ids", path, errors);
  optionalStringArray(turn, "evidence_ids", path, errors);
  if (turn.pacing !== undefined) {
    requireSynthesisString(turn, "pacing", path, errors);
  }
  if (turn.emotion !== undefined) {
    requireSynthesisString(turn, "emotion", path, errors);
  }
  if (turn.transition !== undefined) {
    requireSynthesisString(turn, "transition", path, errors);
  }
  if (turn.audio_notes !== undefined) {
    requireSynthesisString(turn, "audio_notes", path, errors);
  }
}

function validateShowSection(section: unknown, index: number, errors: string[]) {
  const path = ["sections", String(index)];
  if (!requireSynthesisRecord(section, path, errors)) return;

  requireSynthesisString(section, "id", path, errors);
  requireSynthesisString(section, "title", path, errors);
  optionalPositiveInteger(section, "target_duration_seconds", path, errors);
  optionalStringArray(section, "synthesis_unit_ids", path, errors);

  if (!Array.isArray(section.turns) || section.turns.length === 0) {
    errors.push(`${synthesisPathOf([...path, "turns"])}: must include at least one turn`);
    return;
  }
  section.turns.forEach((turn, turnIndex) => validateShowTurn(turn, index, turnIndex, errors));
}

function validatePronunciationNote(note: unknown, index: number, errors: string[]) {
  const path = ["pronunciation_notes", String(index)];
  if (!requireSynthesisRecord(note, path, errors)) return;

  requireSynthesisString(note, "term", path, errors);
  requireSynthesisString(note, "hint", path, errors);
}

function validateProviderRequirements(value: unknown, errors: string[]) {
  const path = ["provider_requirements"];
  if (!requireSynthesisRecord(value, path, errors)) return;

  optionalBoolean(value, "multi_voice", path, errors);
  optionalBoolean(value, "long_form", path, errors);
  optionalBoolean(value, "segment_generation", path, errors);
  for (const key of ["multi_voice", "long_form", "segment_generation"]) {
    if (value[key] === undefined) {
      errors.push(`${synthesisPathOf([...path, key])}: must be a boolean`);
    }
  }
  if (value.preferred_output_format !== undefined) {
    requireSynthesisEnum(value, "preferred_output_format", audioOutputFormats, path, errors);
  }
}

export function validateShowScript(showScript: unknown) {
  const errors: string[] = [];

  if (!requireSynthesisRecord(showScript, [], errors)) return errors;

  if (showScript.schema_version !== "1") {
    errors.push('schema_version: must be "1"');
  }

  if (requireSynthesisRecord(showScript.source_synthesis, ["source_synthesis"], errors)) {
    requireSynthesisString(showScript.source_synthesis, "file", ["source_synthesis"], errors);
    if (showScript.source_synthesis.id !== undefined) {
      requireSynthesisString(showScript.source_synthesis, "id", ["source_synthesis"], errors);
    }
  }

  requireSynthesisEnum(showScript, "intent", showScriptIntents, [], errors);
  requireSynthesisEnum(showScript, "format", showScriptFormats, [], errors);
  requireSynthesisString(showScript, "language", [], errors);
  requireSynthesisString(showScript, "title", [], errors);
  if (showScript.listening_context !== undefined) {
    requireSynthesisString(showScript, "listening_context", [], errors);
  }
  optionalPositiveInteger(showScript, "target_duration_seconds", [], errors);

  if (!Array.isArray(showScript.hosts) || showScript.hosts.length === 0) {
    errors.push("hosts: must include at least one host");
  } else {
    showScript.hosts.forEach((host, index) => validateShowHost(host, index, errors));
  }

  if (!Array.isArray(showScript.sections) || showScript.sections.length === 0) {
    errors.push("sections: must include at least one section");
  } else {
    showScript.sections.forEach((section, index) => validateShowSection(section, index, errors));
  }

  if (showScript.pronunciation_notes !== undefined) {
    if (!Array.isArray(showScript.pronunciation_notes)) {
      errors.push("pronunciation_notes: must be an array");
    } else {
      showScript.pronunciation_notes.forEach((note, index) =>
        validatePronunciationNote(note, index, errors),
      );
    }
  }

  validateProviderRequirements(showScript.provider_requirements, errors);

  return errors;
}

function validateArtifactSizingUnit(
  unit: unknown,
  index: number,
  artifactType: string,
  language: ArtifactSizingLanguage,
  errors: string[],
) {
  const path = ["units", String(index)];
  if (!requireSynthesisRecord(unit, path, errors)) return;

  requireSynthesisString(unit, "synthesis_unit_id", path, errors);
  requireSynthesisEnum(unit, "type", synthesisUnitTypes, path, errors);
  requireSynthesisEnum(unit, "rendering_priority", renderingPriorities, path, errors);
  requireSynthesisEnum(unit, "medium", artifactSizingMedia, path, errors);
  if (unit.notes !== undefined) {
    requireSynthesisString(unit, "notes", path, errors);
  }

  if (artifactType === "briefing_page" && unit.medium !== "newspaper") {
    errors.push(`${synthesisPathOf([...path, "medium"])}: must be newspaper for briefing_page`);
    return;
  }
  if (artifactType === "audio_brief" && unit.medium !== "podcast") {
    errors.push(`${synthesisPathOf([...path, "medium"])}: must be podcast for audio_brief`);
    return;
  }

  if (unit.medium === "newspaper") {
    validateNewspaperSizingUnit(unit, path, language, errors);
  }
  if (unit.medium === "podcast") {
    validatePodcastSizingUnit(unit, path, language, errors);
  }
}

export function validateArtifactSizing(sizing: unknown) {
  const errors: string[] = [];

  if (!requireSynthesisRecord(sizing, [], errors)) return errors;

  if (sizing.schema_version !== "1") {
    errors.push('schema_version: must be "1"');
  }
  requireSynthesisEnum(sizing, "artifact_type", artifactTypes, [], errors);
  requireSynthesisEnum(sizing, "language", artifactSizingLanguages, [], errors);

  const language =
    typeof sizing.language === "string" && artifactSizingLanguages.has(sizing.language)
      ? (sizing.language as ArtifactSizingLanguage)
      : null;
  const artifactType = typeof sizing.artifact_type === "string" ? sizing.artifact_type : null;

  if (!Array.isArray(sizing.units) || sizing.units.length === 0) {
    errors.push("units: must include at least one sizing unit");
  } else if (language !== null && artifactType !== null && artifactTypes.has(artifactType)) {
    sizing.units.forEach((unit, index) =>
      validateArtifactSizingUnit(unit, index, artifactType, language, errors),
    );
  }

  return errors;
}

export async function validateSynthesisFile(file: string) {
  const schema = await fetchCanonicalSchema(canonicalSchemaPaths.structuredSynthesis);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read or parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const errors = [
    ...validateWithJsonSchema(schema, parsed),
    ...validateStructuredSynthesis(parsed),
  ];
  if (errors.length > 0) {
    console.error(`Structured synthesis validation failed for ${file}:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Structured synthesis is valid: ${file}`);
}

export async function printSynthesisSchema() {
  console.log(JSON.stringify(await fetchCanonicalSchema(canonicalSchemaPaths.structuredSynthesis), null, 2));
}

export async function validateShowScriptFile(file: string) {
  const schema = await fetchCanonicalSchema(canonicalSchemaPaths.showScript);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read or parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const errors = [
    ...validateWithJsonSchema(schema, parsed),
    ...validateShowScript(parsed),
  ];
  if (errors.length > 0) {
    console.error(`Show Script validation failed for ${file}:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Show Script is valid: ${file}`);
}

export async function printShowScriptSchema() {
  console.log(JSON.stringify(await fetchCanonicalSchema(canonicalSchemaPaths.showScript), null, 2));
}

export async function validateArtifactSizingFile(file: string) {
  const schema = await fetchCanonicalSchema(canonicalSchemaPaths.artifactSizing);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read or parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const errors = [
    ...validateWithJsonSchema(schema, parsed),
    ...validateArtifactSizing(parsed),
  ];
  if (errors.length > 0) {
    console.error(`Artifact sizing validation failed for ${file}:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Artifact sizing is valid: ${file}`);
}

export async function printArtifactSizingSchema() {
  console.log(JSON.stringify(await fetchCanonicalSchema(canonicalSchemaPaths.artifactSizing), null, 2));
}
