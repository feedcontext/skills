import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { JsonRecord } from "./types";
import { validateShowScript } from "./validation";

type Host = {
  id: string;
  name?: string;
  provider_voice?: string;
  voice_persona_id?: string;
};

type Turn = {
  audio_notes?: string;
  emotion?: string;
  evidence_ids?: string[];
  pacing?: string;
  speaker: string;
  synthesis_unit_ids?: string[];
  text: string;
  transition?: string;
};

type Section = {
  id: string;
  title: string;
  turns: Turn[];
};

type ShowScript = {
  language: string;
  title: string;
  hosts: Host[];
  sections: Section[];
  provider_requirements: JsonRecord;
};

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Show Script must be a JSON object.");
  }
  return value as JsonRecord;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function padIndex(index: number) {
  return String(index + 1).padStart(3, "0");
}

async function readShowScript(file: string): Promise<ShowScript> {
  const parsed = asRecord(JSON.parse(await readFile(file, "utf8")));
  const errors = validateShowScript(parsed);
  if (errors.length > 0) {
    throw new Error(`Show Script validation failed for ${file}:\n- ${errors.join("\n- ")}`);
  }
  return parsed as unknown as ShowScript;
}

export async function writeAudioSegments(options: { out: string; scriptFile: string }) {
  const showScript = await readShowScript(options.scriptFile);
  const hosts = new Map(showScript.hosts.map((host) => [host.id, host]));
  const segments = showScript.sections.flatMap((section) => {
    const sectionSlug = slugify(section.id || section.title);
    return section.turns.map((turn, turnIndex) => {
      const host = hosts.get(turn.speaker);
      return {
        id: `${sectionSlug}-${padIndex(turnIndex)}`,
        section_id: section.id,
        section_title: section.title,
        turn_index: turnIndex,
        speaker: turn.speaker,
        ...(host?.name ? { speaker_label: host.name } : {}),
        text: turn.text,
        ...(host?.provider_voice ? { voice: host.provider_voice } : {}),
        ...(host?.voice_persona_id ? { voice_persona_id: host.voice_persona_id } : {}),
        ...(turn.synthesis_unit_ids ? { synthesis_unit_ids: turn.synthesis_unit_ids } : {}),
        ...(turn.evidence_ids ? { evidence_ids: turn.evidence_ids } : {}),
        ...(turn.pacing ? { pacing: turn.pacing } : {}),
        ...(turn.emotion ? { emotion: turn.emotion } : {}),
        ...(turn.transition ? { transition: turn.transition } : {}),
        ...(turn.audio_notes ? { audio_notes: turn.audio_notes } : {}),
      };
    });
  });

  const manifest = {
    schema_version: "1",
    source_script: { file: options.scriptFile },
    language: showScript.language,
    title: showScript.title,
    provider_requirements: showScript.provider_requirements,
    segments,
  };

  await mkdir(dirname(options.out), { recursive: true });
  await writeFile(options.out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Audio segments written: ${options.out}`);
}
