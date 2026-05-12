import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { JsonRecord } from "./types";

const execFileAsync = promisify(execFile);

type SourceSegment = {
  id: string;
  speaker?: string;
  speaker_label?: string;
  text?: string;
};

type SegmentsManifest = {
  title?: string;
  source_script?: {
    file?: string;
  };
  segments: SourceSegment[];
};

type RenderSegment = {
  id: string;
  file: string;
  status: string;
};

type RenderManifest = {
  source_segments?: {
    file?: string;
  };
  ready_for_assembly?: boolean;
  segments: RenderSegment[];
};

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonRecord;
}

function readRenderManifest(value: JsonRecord): RenderManifest {
  if (value.ready_for_assembly !== true) {
    throw new Error("Audio render manifest is not ready for assembly.");
  }
  if (!Array.isArray(value.segments)) {
    throw new Error("Audio render manifest must include a segments array.");
  }
  if (
    typeof value.source_segments !== "object" ||
    value.source_segments === null ||
    Array.isArray(value.source_segments) ||
    typeof (value.source_segments as JsonRecord).file !== "string" ||
    (value.source_segments as JsonRecord).file === ""
  ) {
    throw new Error("Audio render manifest must include source_segments.file.");
  }
  for (const [index, segment] of value.segments.entries()) {
    if (
      typeof segment !== "object" ||
      segment === null ||
      Array.isArray(segment) ||
      typeof (segment as JsonRecord).id !== "string" ||
      typeof (segment as JsonRecord).file !== "string" ||
      (segment as JsonRecord).status !== "reuse"
    ) {
      throw new Error(`render segments.${index} must reference a reusable audio file.`);
    }
  }
  return value as unknown as RenderManifest;
}

function readSegmentsManifest(value: JsonRecord): SegmentsManifest {
  if (!Array.isArray(value.segments)) {
    throw new Error("Audio segments manifest must include a segments array.");
  }
  return value as unknown as SegmentsManifest;
}

function ffmpegConcatPath(value: string) {
  return `'${resolve(value).replaceAll("'", "'\\''")}'`;
}

function playbackText(segments: SourceSegment[]) {
  return segments
    .filter((segment) => typeof segment.text === "string" && segment.text.trim() !== "")
    .map((segment) => {
      const label = segment.speaker_label || segment.speaker;
      return label ? `${label}: ${segment.text}` : segment.text;
    })
    .join("\n\n");
}

async function existingFile(path: string) {
  await access(path);
  return path;
}

async function bundledAudio(name: "intro.mp3" | "outro.mp3") {
  return existingFile(fileURLToPath(new URL(`../assets/audio/${name}`, import.meta.url)));
}

export async function assembleAudioBrief(options: {
  ffmpegBin?: string;
  introAudio?: string;
  manifestOut: string;
  noDefaultMusic?: boolean;
  out: string;
  outroAudio?: string;
  renderManifest: string;
}) {
  const render = readRenderManifest(
    asRecord(JSON.parse(await readFile(options.renderManifest, "utf8")), "Audio render manifest"),
  );
  const segmentsFile = render.source_segments?.file as string;
  const sourceSegments = readSegmentsManifest(
    asRecord(JSON.parse(await readFile(segmentsFile, "utf8")), "Audio segments manifest"),
  );
  const segmentInputs = render.segments.map((segment) => ({
    id: segment.id,
    file: segment.file,
    kind: "segment" as const,
  }));
  const introAudio = options.noDefaultMusic
    ? undefined
    : options.introAudio || (await bundledAudio("intro.mp3"));
  const outroAudio = options.noDefaultMusic
    ? undefined
    : options.outroAudio || (await bundledAudio("outro.mp3"));
  const inputs = [
    ...(introAudio ? [{ file: introAudio, kind: "intro" as const }] : []),
    ...segmentInputs,
    ...(outroAudio ? [{ file: outroAudio, kind: "outro" as const }] : []),
  ];
  const lyricsFile = `${options.out}.lyrics.txt`;
  const concatDirectory = await mkdtemp(join(tmpdir(), "feedcontext-audio-assemble-"));
  const concatFile = join(concatDirectory, "concat.txt");
  const title = sourceSegments.title || "Audio Brief";
  const artist = "FeedContext";
  const album = "Audio Briefs";
  const albumArtist = "FeedContext";

  await mkdir(dirname(options.out), { recursive: true });
  await writeFile(
    concatFile,
    `${inputs.map((input) => `file ${ffmpegConcatPath(input.file)}`).join("\n")}\n`,
  );
  await writeFile(lyricsFile, `${playbackText(sourceSegments.segments)}\n`);

  await execFileAsync(options.ffmpegBin || "ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-metadata",
    `title=${title}`,
    "-metadata",
    `artist=${artist}`,
    "-metadata",
    `album=${album}`,
    "-metadata",
    `album_artist=${albumArtist}`,
    "-metadata",
    `lyrics=${playbackText(sourceSegments.segments)}`,
    options.out,
  ]);

  const assemblyManifest = {
    schema_version: "1",
    source_render_manifest: { file: options.renderManifest },
    source_segments: { file: segmentsFile },
    source_script: sourceSegments.source_script,
    final_out: options.out,
    title,
    artist,
    album,
    album_artist: albumArtist,
    lyrics_file: lyricsFile,
    inputs,
    ffmpeg_bin: options.ffmpegBin || "ffmpeg",
    ready_for_review: true,
    review_required: true,
  };

  await mkdir(dirname(options.manifestOut), { recursive: true });
  await writeFile(options.manifestOut, `${JSON.stringify(assemblyManifest, null, 2)}\n`);
  console.log(`Audio brief assembled: ${options.out}`);
  console.log(`Audio assembly manifest written: ${options.manifestOut}`);
}
