import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { JsonRecord } from "./types";

type Segment = {
  id: string;
  speaker?: string;
  text?: string;
  voice?: string;
  voice_persona_id?: string;
};

type SegmentManifest = {
  provider_requirements?: {
    preferred_output_format?: string;
  };
  segments: Segment[];
};

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Audio segments manifest must be a JSON object.");
  }
  return value as JsonRecord;
}

function readSegments(value: JsonRecord): SegmentManifest {
  if (!Array.isArray(value.segments)) {
    throw new Error("Audio segments manifest must include a segments array.");
  }
  for (const [index, segment] of value.segments.entries()) {
    if (
      typeof segment !== "object" ||
      segment === null ||
      Array.isArray(segment) ||
      typeof (segment as JsonRecord).id !== "string" ||
      (segment as JsonRecord).id === ""
    ) {
      throw new Error(`segments.${index}.id must be a non-empty string.`);
    }
  }
  return value as unknown as SegmentManifest;
}

function outputExtension(manifest: SegmentManifest) {
  const preferred = manifest.provider_requirements?.preferred_output_format;
  if (preferred === "wav") return "wav";
  if (preferred === "mp3") return "mp3";
  return "m4a";
}

async function segmentStatus(file: string) {
  try {
    const fileStat = await stat(file);
    if (fileStat.size <= 0) {
      return { file, status: "empty" as const };
    }
    return { bytes: fileStat.size, file, status: "reuse" as const };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { file, status: "missing" as const };
    }
    throw error;
  }
}

export async function writeAudioRenderManifest(options: {
  manifestOut: string;
  resume: boolean;
  retryOut?: string;
  segmentDir: string;
  segmentsFile: string;
}) {
  const parsed = readSegments(asRecord(JSON.parse(await readFile(options.segmentsFile, "utf8"))));
  const extension = outputExtension(parsed);
  const segments = await Promise.all(
    parsed.segments.map(async (segment) => ({
      id: segment.id,
      ...(await segmentStatus(join(options.segmentDir, `${segment.id}.${extension}`))),
    })),
  );
  const reusableCount = segments.filter((segment) => segment.status === "reuse").length;
  const missingCount = segments.length - reusableCount;
  const manifest = {
    schema_version: "1",
    source_segments: { file: options.segmentsFile },
    segment_dir: options.segmentDir,
    resume: options.resume,
    reusable_count: reusableCount,
    missing_count: missingCount,
    ready_for_assembly: missingCount === 0,
    segments,
  };

  await mkdir(dirname(options.manifestOut), { recursive: true });
  await writeFile(options.manifestOut, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Audio render manifest written: ${options.manifestOut}`);

  if (options.retryOut) {
    const segmentsById = new Map(parsed.segments.map((segment) => [segment.id, segment]));
    const retryQueue = {
      schema_version: "1",
      source_segments: { file: options.segmentsFile },
      segment_dir: options.segmentDir,
      segments: segments
        .filter((segment) => segment.status !== "reuse")
        .map((segment) => {
          const source = segmentsById.get(segment.id);
          return {
            id: segment.id,
            file: segment.file,
            reason: segment.status,
            ...(source?.speaker ? { speaker: source.speaker } : {}),
            ...(source?.text ? { text: source.text } : {}),
            ...(source?.voice ? { voice: source.voice } : {}),
            ...(source?.voice_persona_id ? { voice_persona_id: source.voice_persona_id } : {}),
          };
        }),
    };
    await mkdir(dirname(options.retryOut), { recursive: true });
    await writeFile(options.retryOut, `${JSON.stringify(retryQueue, null, 2)}\n`);
    console.log(`Audio retry queue written: ${options.retryOut}`);
  }
}
