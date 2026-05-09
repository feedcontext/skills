import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import WebSocket from "ws";
import { DEFAULT_AUDIO_PROVIDER, DEFAULT_INTRO_AUDIO, DEFAULT_OUTRO_AUDIO } from "./config";
import type { AudioBriefArtworkPreparer, AudioBriefArtworkResult, AudioDurationProbe, AudioProviderDiagnostic, AudioProviderId, BingEdgeTtsOptions, BingEdgeTtsSegment, BingEdgeTtsSegmentsFile, BingEdgeTtsSegmentsOptions, BingEdgeTtsSynthesizer, CommandRunner, DetectAudioProvidersOptions, JsonRecord, RenderedBingEdgeTtsSegment, TimedScriptEmbedder, TimedScriptEmbeddingResult } from "./types";
import { isRecord, parseConcurrency, runWithConcurrency } from "./utils";
import { validateShowScript } from "./validation";

const ARTWORK_SIZE = 1400;
const ARTWORK_BRAND_TEXT = "FeedContext";

const BITMAP_FONT: Record<string, string[]> = {
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  d: ["00001", "00001", "01101", "10011", "10001", "10011", "01101"],
  e: ["00000", "01110", "10001", "11111", "10000", "10001", "01110"],
  n: ["00000", "10110", "11001", "10001", "10001", "10001", "10001"],
  o: ["00000", "01110", "10001", "10001", "10001", "10001", "01110"],
  t: ["00100", "00100", "11111", "00100", "00100", "00101", "00010"],
  x: ["00000", "10001", "01010", "00100", "01010", "10001", "10001"],
};

type VoicePersona = {
  displayName: string;
  gender: "female" | "male" | "neutral";
  id: string;
  pitch?: string;
  provider: "bing-edge";
  providerVoice: string;
  rate?: string;
  roleTone: string;
  volume?: string;
};

const BING_EDGE_VOICE_PERSONAS: VoicePersona[] = [
  {
    displayName: "林晓",
    gender: "female",
    id: "bing-edge/zh-CN-XiaoxiaoNeural",
    pitch: "-10Hz",
    provider: "bing-edge",
    providerVoice: "zh-CN-XiaoxiaoNeural",
    rate: "-7%",
    roleTone: "清晰、温和、适合叙事 lead",
  },
  {
    displayName: "周熙",
    gender: "male",
    id: "bing-edge/zh-CN-YunxiNeural",
    pitch: "-12Hz",
    provider: "bing-edge",
    providerVoice: "zh-CN-YunxiNeural",
    rate: "-5%",
    roleTone: "年轻、自然、适合补充和追问",
  },
  {
    displayName: "Maya",
    gender: "female",
    id: "bing-edge/en-US-AvaNeural",
    pitch: "-3Hz",
    provider: "bing-edge",
    providerVoice: "en-US-AvaNeural",
    rate: "-2%",
    roleTone: "warm, clear, conversational lead",
  },
  {
    displayName: "Noah",
    gender: "male",
    id: "bing-edge/en-US-GuyNeural",
    pitch: "-4Hz",
    provider: "bing-edge",
    providerVoice: "en-US-GuyNeural",
    rate: "-2%",
    roleTone: "concise, curious, conversational co-host",
  },
];

const BING_EDGE_VOICE_PERSONA_BY_ID = new Map(
  BING_EDGE_VOICE_PERSONAS.map((persona) => [persona.id, persona]),
);
const BING_EDGE_VOICE_PERSONA_BY_PROVIDER_VOICE = new Map(
  BING_EDGE_VOICE_PERSONAS.map((persona) => [persona.providerVoice, persona]),
);

function languagePersonaKey(language?: string) {
  const normalized = language?.trim();
  if (normalized?.toLowerCase().startsWith("zh")) return "zh-CN";
  if (normalized?.toLowerCase().startsWith("en")) return "en-US";
  return undefined;
}

function definedRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
function bingEdgeProviderDiagnostic(): AudioProviderDiagnostic {
  return {
    available: true,
    default: true,
    id: "bing-edge" as const,
    invocation: {
      command: "node scripts/helper.mjs audio render",
      example_args: [
        "--segments-file",
        "show.segments.json",
        "--out-dir",
        "show-segments",
        "--concurrency",
        "4",
        "--out",
        "show.bing-edge.segments.json",
      ],
    },
    label: "Bing Edge TTS",
    notes: [
      "Uses the helper's built-in Edge Read Aloud client to access Microsoft Edge's online text-to-speech service.",
      "No API key, Python package, or external edge-tts CLI is required.",
    ],
    privacy_boundary:
      "The Show Script text needed for this Audio Brief is sent to Microsoft's Edge online text-to-speech service.",
    provider_class: "production" as const,
  };
}

export async function detectAudioProviders({
  provider,
}: DetectAudioProvidersOptions = {}) {
  const providers: AudioProviderDiagnostic[] = [];

  if (provider === undefined || provider === "bing-edge") {
    providers.push(bingEdgeProviderDiagnostic());
  }

  return { default_provider: DEFAULT_AUDIO_PROVIDER, providers };
}

export async function printAudioProviderDoctor(options: { provider?: AudioProviderId }) {
  console.log(JSON.stringify(await detectAudioProviders({ provider: options.provider }), null, 2));
}

function escapeSsmlText(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function defaultBingEdgeVoiceForLanguage(language?: string) {
  return defaultBingEdgeVoiceForLanguageAndGender(language, "neutral");
}

function resolveBingEdgePersonaForLanguageAndGender({
  gender,
  language,
}: {
  gender?: string;
  language?: string;
}) {
  const personaKey = languagePersonaKey(language);
  const normalizedGender = gender === "male" || gender === "female" ? gender : undefined;
  const personaIds =
    personaKey === "zh-CN"
      ? ["bing-edge/zh-CN-XiaoxiaoNeural", "bing-edge/zh-CN-YunxiNeural"]
      : personaKey === "en-US"
        ? ["bing-edge/en-US-AvaNeural", "bing-edge/en-US-GuyNeural"]
        : undefined;
  if (!personaIds) return undefined;

  const personas = personaIds
    .map((id) => BING_EDGE_VOICE_PERSONA_BY_ID.get(id))
    .filter((persona): persona is VoicePersona => persona !== undefined);
  return personas.find((persona) => persona.gender === normalizedGender) ?? personas[0];
}

function defaultBingEdgeVoiceForLanguageAndGender(
  language?: string,
  gender?: string,
) {
  const persona = resolveBingEdgePersonaForLanguageAndGender({ gender, language });
  if (persona) return persona.providerVoice;

  const normalized = language?.trim().toLowerCase();
  const normalizedGender = gender === "male" || gender === "female" ? gender : "neutral";
  if (normalized?.startsWith("zh")) {
    return normalizedGender === "male" ? "zh-CN-YunxiNeural" : "zh-CN-XiaoxiaoNeural";
  }
  if (normalized?.startsWith("ja")) {
    return normalizedGender === "male" ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural";
  }
  if (normalized?.startsWith("ko")) {
    return normalizedGender === "male" ? "ko-KR-InJoonNeural" : "ko-KR-SunHiNeural";
  }
  if (normalized?.startsWith("es")) {
    return normalizedGender === "male" ? "es-ES-AlvaroNeural" : "es-ES-ElviraNeural";
  }
  if (normalized?.startsWith("fr")) {
    return normalizedGender === "male" ? "fr-FR-HenriNeural" : "fr-FR-DeniseNeural";
  }
  if (normalized?.startsWith("de")) {
    return normalizedGender === "male" ? "de-DE-ConradNeural" : "de-DE-KatjaNeural";
  }
  return normalizedGender === "male" ? "en-US-GuyNeural" : "en-US-AvaNeural";
}

function edgeTtsRequestId() {
  return randomBytes(16).toString("hex");
}

function edgeTtsSecMsGec() {
  const trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const roundedTicks = ticks - (ticks % 300);
  const windowsTicks = BigInt(roundedTicks) * 10_000_000n;
  return createHash("sha256")
    .update(`${windowsTicks}${trustedClientToken}`)
    .digest("hex")
    .toUpperCase();
}

function edgeTtsSpeechConfig() {
  return `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: "false",
            wordBoundaryEnabled: "false",
          },
          outputFormat: "audio-24khz-96kbitrate-mono-mp3",
        },
      },
    },
  })}`;
}

function edgeTtsSsml({
  pitch = "default",
  rate = "default",
  text,
  voice,
  volume = "default",
}: {
  pitch?: string;
  rate?: string;
  text: string;
  voice: string;
  volume?: string;
}) {
  const voiceLocale = /^[a-z]{2}-[A-Z]{2}/.exec(voice)?.[0] ?? "en-US";
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voiceLocale}">
  <voice name="${voice}">
    <prosody pitch="${escapeSsmlText(pitch)}" rate="${escapeSsmlText(rate)}" volume="${escapeSsmlText(volume)}">
      ${escapeSsmlText(text)}
    </prosody>
  </voice>
</speak>`;
}

async function synthesizeBingEdgeTtsFile({ out, pitch, rate, text, voice, volume }: {
  out: string;
  pitch?: string;
  rate?: string;
  text: string;
  voice: string;
  volume?: string;
}) {
  if (process.env.FEEDCONTEXT_TEST_FIXTURE_TTS === "1") {
    await defaultCommandRunner("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=24000:cl=mono",
      "-t",
      "4",
      "-q:a",
      "9",
      "-acodec",
      "libmp3lame",
      out,
    ]);
    return;
  }

  const trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const connectionId = edgeTtsRequestId();
  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${trustedClientToken}` +
    `&Sec-MS-GEC=${edgeTtsSecMsGec()}` +
    `&Sec-MS-GEC-Version=1-143.0.3650.96` +
    `&ConnectionId=${connectionId}`;
  const requestId = edgeTtsRequestId();
  const writable = createWriteStream(out);
  let audioBytes = 0;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      },
    });
    let settled = false;

    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      ws.close();
      writable.destroy(error instanceof Error ? error : new Error(String(error)));
      reject(error instanceof Error ? error : new Error(String(error)));
    }

    function finish() {
      if (settled) return;
      settled = true;
      ws.close();
      writable.end(() => {
        if (audioBytes > 0) {
          resolve();
          return;
        }
        reject(new Error("No audio data received from Bing Edge TTS."));
      });
    }

    ws.once("open", () => {
      ws.send(edgeTtsSpeechConfig());
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${edgeTtsSsml({ pitch, rate, text, voice, volume })}`,
      );
    });
    ws.once("error", fail);
    writable.once("error", fail);
    ws.on("message", (data) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const message = buffer.toString();
      if (message.includes("Path:turn.end")) {
        finish();
        return;
      }
      if (!message.includes("Path:audio")) return;

      const audioHeader = "Path:audio\r\n";
      const audioStart = buffer.indexOf(audioHeader) + audioHeader.length;
      if (audioStart < audioHeader.length) return;
      const audio = buffer.subarray(audioStart);
      audioBytes += audio.length;
      if (!writable.write(audio)) {
        ws.pause();
        writable.once("drain", () => ws.resume());
      }
    });
    ws.once("close", () => {
      if (!settled) finish();
    });
  });
}

async function defaultCommandRunner(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, { timeout: 120_000 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function probeAudioDurationSeconds(file: string) {
  return new Promise<number>((resolve, reject) => {
    execFile(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        file,
      ],
      { timeout: 30_000 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        const duration = Number.parseFloat(stdout.trim());
        if (!Number.isFinite(duration) || duration < 0) {
          reject(new Error(`Could not read audio duration for ${file}`));
          return;
        }
        resolve(duration);
      },
    );
  });
}

async function concatAudioFiles(
  files: string[],
  out: string,
  metadata: { title?: string } = {},
  run: CommandRunner = defaultCommandRunner,
) {
  if (files.length === 0) {
    throw new Error("Audio concat requires at least one input file.");
  }
  const listFile = `${out}.concat.txt`;
  const content = files
    .map((file) => `file '${file.replaceAll("'", "'\\''")}'`)
    .join("\n");
  await writeFile(listFile, `${content}\n`);
  try {
    const isM4a = extname(out).toLowerCase() === ".m4a";
    const title = metadata.title?.trim() || basename(audioFileStem(out));
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-metadata",
      `title=${title}`,
      "-metadata",
      "artist=FeedContext",
      "-metadata",
      "album=FeedContext Audio Brief",
      ...(isM4a
        ? ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]
        : ["-c", "copy"]),
      out,
    ]);
  } finally {
    await unlink(listFile).catch(() => undefined);
  }
}

function audioFileStem(path: string) {
  const extension = extname(path);
  return extension ? path.slice(0, -extension.length) : path;
}

function timedScriptSidecarPath(audioFile: string) {
  return `${audioFileStem(audioFile)}.lyrics.txt`;
}

function syncedLyricsSidecarPath(audioFile: string) {
  return `${audioFileStem(audioFile)}.lrc`;
}

function artworkSidecarPath(audioFile: string) {
  return `${audioFileStem(audioFile)}.cover.png`;
}

function timedScriptTextFromSegments(segments: BingEdgeTtsSegment[]) {
  return segments
    .map((segment) => {
      const speaker = segment.speaker_label?.trim() || segment.speaker?.trim();
      return speaker ? `${speaker}: ${segment.text}` : segment.text;
    })
    .join("\n\n")
    .concat("\n");
}

function lrcTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainingSeconds.toFixed(2).padStart(5, "0")}`;
}

function syncedLyricsTextFromSegments(segments: RenderedBingEdgeTtsSegment[]) {
  if (segments.some((segment) => segment.start_seconds === undefined)) {
    return undefined;
  }
  return segments
    .map((segment) => {
      const speaker = segment.speaker_label?.trim() || segment.speaker?.trim();
      const text = speaker ? `${speaker}: ${segment.text}` : segment.text;
      return `[${lrcTimestamp(segment.start_seconds ?? 0)}]${text}`;
    })
    .join("\n")
    .concat("\n");
}

async function embedTimedScriptMetadata(
  options: {
    audioFile: string;
    sidecarFile: string;
    text: string;
  },
  run: CommandRunner = defaultCommandRunner,
): Promise<TimedScriptEmbeddingResult> {
  await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    options.audioFile,
  ]);

  const extension = extname(options.audioFile) || ".m4a";
  const tempFile = `${options.audioFile}.metadata${extension}`;
  try {
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      options.audioFile,
      "-metadata",
      `lyrics=${options.text}`,
      "-metadata",
      `comment=Timed Script playback text embedded; sidecar: ${basename(options.sidecarFile)}`,
      "-codec",
      "copy",
      tempFile,
    ]);
    await rename(tempFile, options.audioFile);
    return {
      embedded: true,
      metadata_fields: ["lyrics", "comment"],
    };
  } finally {
    await unlink(tempFile).catch(() => undefined);
  }
}

function setPixel(buffer: Buffer, width: number, x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const offset = (y * width + x) * 3;
  buffer[offset] = r;
  buffer[offset + 1] = g;
  buffer[offset + 2] = b;
}

function fillRect(
  buffer: Buffer,
  width: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: [number, number, number],
) {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) {
      setPixel(buffer, width, xx, yy, color[0], color[1], color[2]);
    }
  }
}

function drawBitmapText(buffer: Buffer, width: number, text: string, x: number, y: number, scale: number) {
  let cursor = x;
  for (const char of text) {
    const glyph = BITMAP_FONT[char];
    if (!glyph) {
      cursor += scale * 4;
      continue;
    }
    glyph.forEach((row, rowIndex) => {
      Array.from(row).forEach((value, columnIndex) => {
        if (value !== "1") return;
        fillRect(buffer, width, cursor + columnIndex * scale, y + rowIndex * scale, scale, scale, [
          238,
          242,
          247,
        ]);
      });
    });
    cursor += scale * 6;
  }
}

async function writeFixedTemplateArtworkPng(out: string, run: CommandRunner = defaultCommandRunner) {
  const size = ARTWORK_SIZE;
  const buffer = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 3;
      const diagonal = (x + y) / (size * 2);
      const band = Math.sin((x - y) / 70) * 18;
      buffer[offset] = Math.round(20 + diagonal * 58 + band);
      buffer[offset + 1] = Math.round(28 + diagonal * 70);
      buffer[offset + 2] = Math.round(44 + diagonal * 92 - band);
    }
  }
  fillRect(buffer, size, 76, 1228, 432, 86, [12, 18, 30]);
  fillRect(buffer, size, 76, 1228, 12, 86, [97, 218, 251]);
  drawBitmapText(buffer, size, ARTWORK_BRAND_TEXT, 112, 1252, 7);

  const ppmFile = `${out}.ppm`;
  await writeFile(ppmFile, Buffer.concat([Buffer.from(`P6\n${size} ${size}\n255\n`), buffer]));
  try {
    await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", ppmFile, out]);
  } finally {
    await unlink(ppmFile).catch(() => undefined);
  }
}

async function brandArtworkFile(
  input: string,
  out: string,
  run: CommandRunner = defaultCommandRunner,
) {
  const escapedText = ARTWORK_BRAND_TEXT.replaceAll("'", "\\'");
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input,
    "-vf",
    `scale=${ARTWORK_SIZE}:${ARTWORK_SIZE}:force_original_aspect_ratio=increase,crop=${ARTWORK_SIZE}:${ARTWORK_SIZE},drawbox=x=76:y=1228:w=432:h=86:color=0x0c121e@0.92:t=fill,drawbox=x=76:y=1228:w=12:h=86:color=0x61dafb@1:t=fill,drawtext=text='${escapedText}':x=112:y=1250:fontsize=42:fontcolor=0xeef2f7`,
    "-frames:v",
    "1",
    out,
  ]);
}

async function embedArtworkMetadata(
  options: {
    artworkFile: string;
    audioFile: string;
  },
  run: CommandRunner = defaultCommandRunner,
) {
  const extension = extname(options.audioFile) || ".m4a";
  const normalizedExtension = extension.toLowerCase();
  if (normalizedExtension === ".m4a" || normalizedExtension === ".mp4") {
    try {
      await run("AtomicParsley", [
        options.audioFile,
        "--artwork",
        options.artworkFile,
        "--overWrite",
      ]);
      return { embedded: true, mode: "apple_covr" as const };
    } catch {
      // Fall through to ffmpeg attached-picture metadata when AtomicParsley is
      // unavailable or cannot update this file.
    }
  }
  const tempFile = `${options.audioFile}.artwork${extension}`;
  const embeddedArtworkFile = `${options.audioFile}.artwork.jpg`;
  try {
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      options.artworkFile,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      embeddedArtworkFile,
    ]);
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      options.audioFile,
      "-i",
      embeddedArtworkFile,
      "-map",
      "0:a",
      "-map",
      "1:v",
      "-map_metadata",
      "0",
      "-c:a",
      "copy",
      "-c:v",
      "mjpeg",
      "-disposition:v:0",
      "attached_pic",
      "-metadata:s:v",
      "title=Album cover",
      "-metadata:s:v",
      "comment=Cover (front)",
      tempFile,
    ]);
    await rename(tempFile, options.audioFile);
    return { embedded: true, mode: "ffmpeg_attached_pic" as const };
  } finally {
    await unlink(tempFile).catch(() => undefined);
    await unlink(embeddedArtworkFile).catch(() => undefined);
  }
}

async function prepareAudioBriefArtwork({
  artworkFile,
  audioFile,
}: {
  artworkFile?: string;
  audioFile: string;
  displayTitle: string;
}): Promise<AudioBriefArtworkResult> {
  const out = artworkSidecarPath(audioFile);
  let source: AudioBriefArtworkResult["artwork_source"] = artworkFile ? "agent_generated" : "fixed_template";
  if (artworkFile) {
    try {
      await brandArtworkFile(artworkFile, out);
    } catch {
      source = "fixed_template";
      await writeFixedTemplateArtworkPng(out);
    }
  } else {
    await writeFixedTemplateArtworkPng(out);
  }

  try {
    const embedding = await embedArtworkMetadata({ artworkFile: out, audioFile });
    return {
      artwork_brand_applied: true,
      artwork_embedded: embedding.embedded,
      artwork_embedding_mode: embedding.mode,
      artwork_file: out,
      artwork_source: source,
    };
  } catch (error) {
    return {
      artwork_brand_applied: true,
      artwork_embedded: false,
      artwork_embedding_error: error instanceof Error ? error.message : String(error),
      artwork_file: out,
      artwork_source: source,
    };
  }
}

async function preserveTimedScript({
  audioFile,
  embed,
  segments,
}: {
  audioFile: string;
  embed: TimedScriptEmbedder;
  segments: RenderedBingEdgeTtsSegment[];
}) {
  const sidecarFile = timedScriptSidecarPath(audioFile);
  const syncedSidecarFile = syncedLyricsSidecarPath(audioFile);
  const text = timedScriptTextFromSegments(segments);
  const syncedText = syncedLyricsTextFromSegments(segments);
  await writeFile(sidecarFile, text);
  if (syncedText !== undefined) {
    await writeFile(syncedSidecarFile, syncedText);
  }

  try {
    const embedding = await embed({ audioFile, sidecarFile, text });
    return {
      embedded: embedding.embedded,
      embedding_error: embedding.embedding_error,
      format: "unsynchronized_lyrics",
      metadata_fields: embedding.metadata_fields,
      sidecar_file: sidecarFile,
      synced_sidecar_file: syncedText === undefined ? undefined : syncedSidecarFile,
      timing_source: "none",
      synced_timing_source: syncedText === undefined ? "unavailable" : "segment_durations",
    };
  } catch (error) {
    return {
      embedded: false,
      embedding_error: error instanceof Error ? error.message : String(error),
      format: "unsynchronized_lyrics",
      metadata_fields: [],
      sidecar_file: sidecarFile,
      synced_sidecar_file: syncedText === undefined ? undefined : syncedSidecarFile,
      timing_source: "none",
      synced_timing_source: syncedText === undefined ? "unavailable" : "segment_durations",
    };
  }
}

async function assignSegmentStartTimes({
  introAudio,
  probeDuration,
  rendered,
}: {
  introAudio?: string;
  probeDuration: AudioDurationProbe;
  rendered: RenderedBingEdgeTtsSegment[];
}) {
  let cursor: number | undefined = 0;
  if (introAudio !== undefined) {
    try {
      cursor = await probeDuration(introAudio);
    } catch {
      cursor = undefined;
    }
  }

  return rendered.map((segment) => {
    const startSeconds = cursor;
    if (cursor !== undefined && segment.duration_seconds !== undefined) {
      cursor += segment.duration_seconds;
    } else {
      cursor = undefined;
    }
    return {
      ...segment,
      start_seconds: startSeconds,
    };
  });
}

export async function renderBingEdgeTts(
  options: BingEdgeTtsOptions,
  synthesize: BingEdgeTtsSynthesizer = synthesizeBingEdgeTtsFile,
) {
  const text = await readFile(options.textFile, "utf8");
  const voice = options.voice ?? defaultBingEdgeVoiceForLanguage(options.language);
  await synthesize({
    out: options.out,
    pitch: options.pitch,
    rate: options.rate,
    text,
    volume: options.volume,
    voice,
  });
  return {
    ok: true,
    out: options.out,
    provider: "bing-edge" as const,
    voice,
  };
}

function parseBingEdgeTtsSegments(value: unknown): BingEdgeTtsSegmentsFile {
  if (!isRecord(value) || !Array.isArray(value.segments)) {
    throw new Error("Segments file must contain a segments array.");
  }

  const title = value.title;
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    throw new Error("title: must be a non-empty string when provided");
  }

  const language = value.language;
  if (language !== undefined && (typeof language !== "string" || language.trim() === "")) {
    throw new Error("language: must be a non-empty string when provided");
  }

  const segments = (value.segments as unknown[]).map((segment, index) => {
    if (!isRecord(segment)) {
      throw new Error(`segments.${index}: must be an object`);
    }
    const id = segment.id;
    const speaker = segment.speaker;
    const speakerLabel = segment.speaker_label;
    const text = segment.text;
    const voice = segment.voice;
    const rate = segment.rate;
    const pitch = segment.pitch;
    const volume = segment.volume;
    const voicePersonaId = segment.voice_persona_id;
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error(`segments.${index}.id: must be a non-empty string`);
    }
    if (speaker !== undefined && (typeof speaker !== "string" || speaker.trim() === "")) {
      throw new Error(`segments.${index}.speaker: must be a non-empty string when provided`);
    }
    if (speakerLabel !== undefined && (typeof speakerLabel !== "string" || speakerLabel.trim() === "")) {
      throw new Error(`segments.${index}.speaker_label: must be a non-empty string when provided`);
    }
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error(`segments.${index}.text: must be a non-empty string`);
    }
    if (voice !== undefined && (typeof voice !== "string" || voice.trim() === "")) {
      throw new Error(`segments.${index}.voice: must be a non-empty string when provided`);
    }
    if (rate !== undefined && (typeof rate !== "string" || rate.trim() === "")) {
      throw new Error(`segments.${index}.rate: must be a non-empty string when provided`);
    }
    if (pitch !== undefined && (typeof pitch !== "string" || pitch.trim() === "")) {
      throw new Error(`segments.${index}.pitch: must be a non-empty string when provided`);
    }
    if (volume !== undefined && (typeof volume !== "string" || volume.trim() === "")) {
      throw new Error(`segments.${index}.volume: must be a non-empty string when provided`);
    }
    if (voicePersonaId !== undefined && (typeof voicePersonaId !== "string" || voicePersonaId.trim() === "")) {
      throw new Error(`segments.${index}.voice_persona_id: must be a non-empty string when provided`);
    }
    return definedRecord({
      id,
      pitch,
      rate,
      speaker,
      speaker_label: speakerLabel,
      text,
      volume,
      voice,
      voice_persona_id: voicePersonaId,
    }) as BingEdgeTtsSegment;
  });

  return { language, segments, title };
}

function segmentFileName(index: number, segment: BingEdgeTtsSegment) {
  const ordinal = String(index + 1).padStart(3, "0");
  const slug = segment.id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${ordinal}-${slug || "segment"}.mp3`;
}

export async function renderBingEdgeTtsSegments(
  options: BingEdgeTtsSegmentsOptions,
  synthesize: BingEdgeTtsSynthesizer = synthesizeBingEdgeTtsFile,
  concat: typeof concatAudioFiles = concatAudioFiles,
  embed: TimedScriptEmbedder = embedTimedScriptMetadata,
  probeDuration: AudioDurationProbe = probeAudioDurationSeconds,
  prepareArtwork: AudioBriefArtworkPreparer = prepareAudioBriefArtwork,
) {
  const concurrency = parseConcurrency(options.concurrency, 4);
  const parsed = JSON.parse(await readFile(options.segmentsFile, "utf8")) as unknown;
  const parsedSegments = parseBingEdgeTtsSegments(parsed);
  const language = options.language ?? parsedSegments.language;
  const voice = options.voice ?? defaultBingEdgeVoiceForLanguage(language);
  const segments = parsedSegments.segments;
  const displayTitle = options.displayTitle?.trim() || parsedSegments.title?.trim() || undefined;
  await mkdir(options.outDir, { recursive: true });
  const rendered = await runWithConcurrency(segments, concurrency, async (segment, index) => {
    const mediaFile = join(options.outDir, segmentFileName(index, segment));
    await synthesize({
      out: mediaFile,
      pitch: segment.pitch,
      rate: segment.rate,
      text: segment.text,
      volume: segment.volume,
      voice: segment.voice ?? voice,
    });
    let durationSeconds: number | undefined;
    try {
      durationSeconds = await probeDuration(mediaFile);
    } catch {
      durationSeconds = undefined;
    }
    return {
      duration_seconds: durationSeconds,
      id: segment.id,
      media_file: mediaFile,
      speaker: segment.speaker,
      speaker_label: segment.speaker_label,
      text: segment.text,
      pitch: segment.pitch,
      rate: segment.rate,
      volume: segment.volume,
      voice_persona_id: segment.voice_persona_id,
      voice: segment.voice ?? voice,
    } satisfies RenderedBingEdgeTtsSegment;
  });

  if (options.finalOut) {
    const introAudio = options.introAudio ?? (options.defaultMusic === false ? undefined : DEFAULT_INTRO_AUDIO);
    const outroAudio = options.outroAudio ?? (options.defaultMusic === false ? undefined : DEFAULT_OUTRO_AUDIO);
    await concat(
      [
        ...(introAudio ? [introAudio] : []),
        ...rendered.map((segment) => segment.media_file),
        ...(outroAudio ? [outroAudio] : []),
      ],
      options.finalOut,
      { title: displayTitle },
    );
    const timedScript = options.timedScript === false
      ? undefined
      : await preserveTimedScript({
          audioFile: options.finalOut,
          embed,
          segments: await assignSegmentStartTimes({
            introAudio,
            probeDuration,
            rendered,
          }),
        });
    const artwork = await prepareArtwork({
      artworkFile: options.artworkFile,
      audioFile: options.finalOut,
      displayTitle: displayTitle ?? basename(audioFileStem(options.finalOut)),
    });
    return {
      artwork,
      final_out: options.finalOut,
      display_title: displayTitle ?? basename(audioFileStem(options.finalOut)),
      intro_audio: introAudio,
      ok: true,
      outro_audio: outroAudio,
      provider: "bing-edge",
      segments: rendered,
      timed_script: timedScript,
      voice,
    };
  }

  return {
    final_out: options.finalOut,
    display_title: displayTitle,
    ok: true,
    provider: "bing-edge" as const,
    segments: rendered,
    voice,
  };
}

function hostGender(host: JsonRecord, index: number, hostCount: number) {
  if (host.gender === "female" || host.gender === "male" || host.gender === "neutral") {
    return host.gender;
  }
  if (hostCount > 1) return index % 2 === 0 ? "female" : "male";
  return "neutral";
}

export function buildAudioSegmentsFromShowScript(
  showScript: unknown,
) {
  const errors = validateShowScript(showScript);
  if (errors.length > 0) {
    throw new Error(`Show Script is invalid: ${errors.join("; ")}`);
  }
  if (!isRecord(showScript)) {
    throw new Error("Show Script must be an object.");
  }

  const language = String(showScript.language);
  const hosts = showScript.hosts as JsonRecord[];
  const hostById = new Map<
    string,
    {
      gender: string;
      name: string;
      pitch?: string;
      providerVoice?: string;
      rate?: string;
      voicePersonaId?: string;
      volume?: string;
    }
  >();
  hosts.forEach((host, index) => {
    const providerVoice = typeof host.provider_voice === "string" ? host.provider_voice : undefined;
    const persona =
      (typeof host.voice_persona_id === "string"
        ? BING_EDGE_VOICE_PERSONA_BY_ID.get(host.voice_persona_id)
        : undefined) ??
      (providerVoice ? BING_EDGE_VOICE_PERSONA_BY_PROVIDER_VOICE.get(providerVoice) : undefined) ??
      resolveBingEdgePersonaForLanguageAndGender({
        gender: hostGender(host, index, hosts.length),
        language,
      });
    hostById.set(String(host.id), {
      gender: hostGender(host, index, hosts.length),
      name:
        typeof host.name === "string" && host.name.trim() !== ""
          ? host.name
          : persona?.displayName ?? String(host.id),
      pitch: persona?.pitch,
      providerVoice: providerVoice ?? persona?.providerVoice,
      rate: persona?.rate,
      voicePersonaId: typeof host.voice_persona_id === "string" ? host.voice_persona_id : persona?.id,
      volume: persona?.volume,
    });
  });

  const segments: BingEdgeTtsSegment[] = [];
  (showScript.sections as JsonRecord[]).forEach((section) => {
    (section.turns as JsonRecord[]).forEach((turn, turnIndex) => {
      const speaker = String(turn.speaker);
      const host = hostById.get(speaker);
      const text = String(turn.text);
      segments.push(definedRecord({
        id: `${String(section.id)}-${String(turnIndex + 1).padStart(2, "0")}`,
        speaker,
        speaker_label: host?.name ?? speaker,
        text,
        pitch: host?.pitch,
        rate: host?.rate,
        volume: host?.volume,
        voice: host?.providerVoice ?? defaultBingEdgeVoiceForLanguageAndGender(language, host?.gender),
        voice_persona_id: host?.voicePersonaId,
      }) as BingEdgeTtsSegment);
    });
  });

  return {
    language,
    segments,
    title: String(showScript.title),
  };
}

export async function writeAudioSegmentsFromShowScript(options: { out: string; scriptFile: string }) {
  const parsed = JSON.parse(await readFile(options.scriptFile, "utf8")) as unknown;
  const segments = buildAudioSegmentsFromShowScript(parsed);
  await writeFile(options.out, `${JSON.stringify(segments, null, 2)}\n`);
  console.log(
    JSON.stringify({ ok: true, out: options.out, segments: segments.segments.length, title: segments.title }, null, 2),
  );
}

export async function renderAudio(options: {
  artworkFile?: string;
  concurrency?: string;
  defaultMusic?: boolean;
  displayTitle?: string;
  finalOut?: string;
  introAudio?: string;
  language?: string;
  out: string;
  outDir?: string;
  outroAudio?: string;
  provider?: AudioProviderId;
  segmentsFile?: string;
  textFile?: string;
  timedScript?: boolean;
  voice?: string;
}) {
  const provider = options.provider ?? DEFAULT_AUDIO_PROVIDER;
  if (provider !== "bing-edge") {
    throw new Error("Unsupported audio provider. Use --provider bing-edge.");
  }

  if (options.segmentsFile) {
    if (!options.outDir) {
      throw new Error("Segmented audio render requires --out-dir.");
    }
    const result = await renderBingEdgeTtsSegments({
      artworkFile: options.artworkFile,
      concurrency: options.concurrency,
      defaultMusic: options.defaultMusic,
      displayTitle: options.displayTitle,
      finalOut: options.finalOut,
      introAudio: options.introAudio,
      language: options.language,
      outroAudio: options.outroAudio,
      outDir: options.outDir,
      segmentsFile: options.segmentsFile,
      timedScript: options.timedScript,
      voice: options.voice,
    });
    await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!options.textFile) {
    throw new Error("Audio render requires --text-file unless --segments-file is provided.");
  }

  const result = await renderBingEdgeTts({
    language: options.language,
    out: options.out,
    textFile: options.textFile,
    voice: options.voice,
  });
  console.log(JSON.stringify(result, null, 2));
}
