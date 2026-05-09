import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { API_ORIGIN } from "./config";
import { getSession } from "./auth";
import type {
  ArtifactDeliverOptions,
  ArtifactDeliveryResult,
  ArtifactType,
  SkillSession,
  UploadContentType,
} from "./types";

export function inferArtifactContentType(file: string, artifactType: ArtifactType): UploadContentType {
  const extension = extname(file).toLowerCase();
  if (artifactType === "briefing_page") {
    if (extension === ".html" || extension === ".htm") return "text/html";
    throw new Error("briefing_page deliverables must be .html files.");
  }

  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".mp3") return "audio/mpeg";
  throw new Error("audio_brief deliverables must be .m4a or .mp3 files.");
}

function validateDisplayFilename(displayFilename: string, contentType: UploadContentType) {
  const hasControlCharacter = [...displayFilename].some((character) => character.charCodeAt(0) < 32);
  if (displayFilename.includes("/") || displayFilename.includes("\\") || hasControlCharacter) {
    throw new Error("display filename must be a safe basename.");
  }
  if (contentType === "text/html" && !displayFilename.endsWith(".html")) {
    throw new Error("text/html deliverables must use a .html display filename.");
  }
  if (contentType === "audio/mp4" && !displayFilename.endsWith(".m4a")) {
    throw new Error("audio/mp4 deliverables must use a .m4a display filename.");
  }
  if (contentType === "audio/mpeg" && !displayFilename.endsWith(".mp3")) {
    throw new Error("audio/mpeg deliverables must use a .mp3 display filename.");
  }
}

function requireConfirm(confirm?: boolean) {
  if (!confirm) {
    throw new Error("Artifact delivery requires host approval and --confirm before network access.");
  }
}

async function readJsonFile(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : {};
  if (!response.ok) {
    throw new Error(`FeedContext API request failed with ${response.status}: ${text || "{}"}`);
  }
  return body;
}

export async function deliverArtifact(
  options: ArtifactDeliverOptions,
  session?: SkillSession,
  fetchFn: typeof fetch = fetch,
): Promise<ArtifactDeliveryResult> {
  requireConfirm(options.confirm);
  const skillSession = session ?? await getSession();

  const artifactType = options.artifactType;
  const fileBytes = await readFile(options.file);
  const contentType = options.contentType ?? inferArtifactContentType(options.file, artifactType);
  const displayFilename = options.displayFilename ?? basename(options.file);
  validateDisplayFilename(displayFilename, contentType);

  const sha256 = createHash("sha256").update(fileBytes).digest("hex");
  const uploadResponse = await fetchFn(`${API_ORIGIN}/v1/uploads`, {
    body: fileBytes,
    headers: {
      authorization: `Bearer ${skillSession.access_token}`,
      "content-length": String(fileBytes.byteLength),
      "content-type": contentType,
      "x-feedcontext-artifact-type": artifactType,
      "x-feedcontext-sha256": sha256,
    },
    method: "PUT",
  });
  const upload = await parseJsonResponse(uploadResponse) as { upload_ref: string };

  const artifactResponse = await fetchFn(`${API_ORIGIN}/v1/artifacts`, {
    body: JSON.stringify({
      artifact_type: artifactType,
      deliveries: [{ caption: options.caption, type: "telegram" }],
      display_filename: displayFilename,
      synthesis: await readJsonFile(options.synthesisFile),
      title: options.title,
      upload_ref: upload.upload_ref,
    }),
    headers: {
      authorization: `Bearer ${skillSession.access_token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const artifact = await parseJsonResponse(artifactResponse) as {
    accepted: boolean;
    artifact_id: string;
  };

  return {
    accepted: artifact.accepted,
    artifact_id: artifact.artifact_id,
    delivery: "telegram",
    upload_ref: upload.upload_ref,
  };
}

export async function deliverArtifactCommand(options: ArtifactDeliverOptions) {
  console.log(JSON.stringify(await deliverArtifact(options)));
}
