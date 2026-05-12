import { execFile } from "node:child_process";
import { access, mkdir, rename, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import type { JsonRecord } from "./types";

const execFileAsync = promisify(execFile);

type AssemblyManifest = {
  album?: string;
  album_artist?: string;
  artist?: string;
  final_out?: string;
  lyrics_file?: string;
  title?: string;
};

type ProbeResult = {
  format?: {
    tags?: Record<string, string>;
  };
  streams?: Array<{
    codec_type?: string;
    disposition?: {
      attached_pic?: number;
    };
  }>;
};

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonRecord;
}

function readAssemblyManifest(value: JsonRecord): AssemblyManifest {
  return value as AssemblyManifest;
}

async function probeAudio(file: string, ffprobeBin: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(ffprobeBin, [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  return JSON.parse(stdout) as ProbeResult;
}

function hasTag(tags: Record<string, string> | undefined, name: string) {
  return typeof tags?.[name] === "string" && tags[name].trim() !== "";
}

function checksFor(probe: ProbeResult) {
  const tags = probe.format?.tags;
  return {
    title: hasTag(tags, "title"),
    artist: hasTag(tags, "artist"),
    album: hasTag(tags, "album"),
    album_artist: hasTag(tags, "album_artist"),
    cover_artwork: Boolean(
      probe.streams?.some((stream) => stream.codec_type === "video" && stream.disposition?.attached_pic),
    ),
    lyrics: hasTag(tags, "lyrics"),
  };
}

function isReady(checks: ReturnType<typeof checksFor>) {
  return Object.values(checks).every(Boolean);
}

async function repairAudio(options: {
  assembly: AssemblyManifest;
  ffmpegBin: string;
  file: string;
}) {
  const lyricsFile = options.assembly.lyrics_file || `${options.file}.lyrics.txt`;
  const coverFile = await firstExistingFile([
    `${options.file.slice(0, -extname(options.file).length)}.cover.png`,
    `${options.file}.cover.png`,
  ]);
  const lyrics = await readFile(lyricsFile, "utf8");
  const repairedFile = join(dirname(options.file), `.repair-${Date.now()}.m4a`);
  await execFileAsync(options.ffmpegBin, [
    "-y",
    "-i",
    options.file,
    "-i",
    coverFile,
    "-map",
    "0:a",
    "-map",
    "1:v",
    "-c:a",
    "copy",
    "-c:v",
    "png",
    "-disposition:v:0",
    "attached_pic",
    "-metadata",
    `title=${options.assembly.title || "Audio Brief"}`,
    "-metadata",
    `artist=${options.assembly.artist || "FeedContext"}`,
    "-metadata",
    `album=${options.assembly.album || "Audio Briefs"}`,
    "-metadata",
    `album_artist=${options.assembly.album_artist || "FeedContext"}`,
    "-metadata",
    `lyrics=${lyrics.trim()}`,
    repairedFile,
  ]);
  await rename(repairedFile, options.file);
}

async function firstExistingFile(paths: string[]) {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  throw new Error(`None of the expected files exist: ${paths.join(", ")}`);
}

export async function reviewAudioBrief(options: {
  assemblyManifest: string;
  ffmpegBin?: string;
  ffprobeBin?: string;
  file: string;
  noRepair?: boolean;
  out: string;
}) {
  const assembly = readAssemblyManifest(
    asRecord(JSON.parse(await readFile(options.assemblyManifest, "utf8")), "Audio assembly manifest"),
  );
  const ffprobeBin = options.ffprobeBin || "ffprobe";
  const ffmpegBin = options.ffmpegBin || "ffmpeg";
  const initialProbe = await probeAudio(options.file, ffprobeBin);
  const initialChecks = checksFor(initialProbe);
  let finalChecks = initialChecks;
  let repaired = false;
  let repairError: string | undefined;

  if (!isReady(initialChecks) && !options.noRepair) {
    try {
      await repairAudio({
        assembly,
        ffmpegBin,
        file: options.file,
      });
      repaired = true;
      finalChecks = checksFor(await probeAudio(options.file, ffprobeBin));
    } catch (error) {
      repairError = error instanceof Error ? error.message : String(error);
    }
  }

  const verdict = isReady(finalChecks) ? (repaired ? "ready_repaired" : "ready") : "blocked";
  const review = {
    schema_version: "1",
    file: options.file,
    assembly_manifest: { file: options.assemblyManifest },
    verdict,
    repaired,
    checks: finalChecks,
    missing: Object.entries(finalChecks)
      .filter(([, value]) => !value)
      .map(([key]) => key),
    ...(repairError ? { repair_error: repairError } : {}),
  };
  await mkdir(dirname(options.out), { recursive: true });
  await writeFile(options.out, `${JSON.stringify(review, null, 2)}\n`);
  console.log(`Audio review verdict: ${verdict}`);
  console.log(`Audio review written: ${options.out}`);
}
