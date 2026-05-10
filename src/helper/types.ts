export type SkillSession = {
  access_token: string;
  expires_at?: number;
  refresh_token?: string;
  token_type: "Bearer";
};

export type RawCall = {
  body?: unknown;
  confirm?: boolean;
  method: string;
  path: string;
};

export type ApiResult = {
  ok: boolean;
  status: number;
  text: string;
};

export type ApiRequester = (input: RawCall, session: SkillSession) => Promise<ApiResult>;

export type ArtifactType = "audio_brief" | "briefing_page";

export type UploadContentType = "audio/mp4" | "audio/mpeg" | "text/html";
export type UploadPurpose = "artifact_deliverable" | "delivery_presentation_asset";

export type ArtifactDeliverOptions = {
  artifactType: ArtifactType;
  caption?: string;
  confirm?: boolean;
  contentType?: UploadContentType;
  displayFilename?: string;
  file: string;
  synthesisFile: string;
  telegramAudioPerformer?: string;
  telegramAudioTitle?: string;
  telegramThumbnailFile?: string;
  title: string;
};

export type ArtifactDeliveryResult = {
  accepted: boolean;
  artifact_id: string;
  delivery: "telegram";
  upload_ref: string;
};

export type OpmlImportResult = {
  created: number;
  existing: number;
  failed: Array<{ error: string; feed_url: string; status?: number }>;
  ok: boolean;
  succeeded: number;
  total: number;
};

export type ListItemsOptions = {
  cursor?: string;
  ids?: string[];
  keyword?: string;
  limit?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  searchContent?: boolean;
  subscriptionId?: string;
};

export type ListAllItemsOptions = ListItemsOptions & {
  maxPages?: string;
};

export type GatherInsightFileOptions = ListItemsOptions & {
  out: string;
};

export type AudioProviderId = "bing-edge";

export type AudioProviderDiagnostic = {
  available: boolean;
  default: boolean;
  id: AudioProviderId;
  label: string;
  notes: string[];
  privacy_boundary: string;
  provider_class: "production";
  reason?: string;
  setup_hint?: string;
  invocation?: {
    command: string;
    example_args: string[];
  };
};

export type DetectAudioProvidersOptions = {
  provider?: AudioProviderId;
};

export type BingEdgeTtsOptions = {
  language?: string;
  out: string;
  pitch?: string;
  rate?: string;
  textFile: string;
  volume?: string;
  voice?: string;
};

export type BingEdgeTtsSegmentsOptions = {
  artworkFile?: string;
  concurrency?: string;
  defaultMusic?: boolean;
  displayTitle?: string;
  finalOut?: string;
  introAudio?: string;
  language?: string;
  outroAudio?: string;
  outDir: string;
  segmentsFile: string;
  timedScript?: boolean;
  voice?: string;
};

export type BingEdgeTtsSegment = {
  id: string;
  pitch?: string;
  rate?: string;
  speaker?: string;
  speaker_label?: string;
  text: string;
  volume?: string;
  voice_persona_id?: string;
  voice?: string;
};

export type RenderedBingEdgeTtsSegment = BingEdgeTtsSegment & {
  duration_seconds?: number;
  media_file: string;
  start_seconds?: number;
};

export type BingEdgeTtsSegmentsFile = {
  language?: string;
  segments: BingEdgeTtsSegment[];
  title?: string;
};

export type BingEdgeTtsSynthesizer = (options: {
  out: string;
  pitch?: string;
  rate?: string;
  text: string;
  volume?: string;
  voice: string;
}) => Promise<void>;

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

export type AudioDurationProbe = (file: string) => Promise<number>;

export type AudioBriefArtworkResult = {
  artwork_brand_applied: boolean;
  artwork_embedded: boolean;
  artwork_embedding_error?: string;
  artwork_embedding_mode?: "apple_covr" | "ffmpeg_attached_pic";
  artwork_file: string;
  artwork_source: "agent_generated" | "fixed_template";
};

export type AudioBriefArtworkPreparer = (options: {
  artworkFile?: string;
  audioFile: string;
  displayTitle: string;
}) => Promise<AudioBriefArtworkResult>;

export type TimedScriptEmbeddingResult = {
  embedded: boolean;
  embedding_error?: string;
  metadata_fields: string[];
};

export type TimedScriptEmbedder = (options: {
  audioFile: string;
  sidecarFile: string;
  text: string;
}) => Promise<TimedScriptEmbeddingResult>;

export type GetItemOptions = {
  cursor?: string;
  id: string;
  includeRaw?: boolean;
  maxChars?: string;
};

export type GetManyItemsOptions = {
  concurrency?: string;
  ids?: string[];
  idsFile?: string;
  includeRaw?: boolean;
  maxChars?: string;
};

export type JsonRecord = Record<string, unknown>;

export type ListItemsResponse = {
  items: unknown[];
  next_cursor: string | null;
};

export type GetManyItemsResult = {
  failed: number;
  ok: boolean;
  results: Array<
    | {
        id: string;
        ok: true;
        response: unknown;
        status: number;
      }
    | {
        error: string;
        id: string;
        ok: false;
        response?: unknown;
        status: number;
      }
  >;
  succeeded: number;
  total: number;
};

export type GatherInsightItem = JsonRecord & {
  id?: unknown;
  summary?: unknown;
  summary_reviewed: true;
};

export type GatherInsightResult = {
  coverage: {
    pages: number;
    summary_reviewed_count: number;
    total: number;
  };
  items: GatherInsightItem[];
  schema_version: "1";
};

export type VersionStatus = {
  name: string;
  installed_revision: string | null;
  latest_revision: string | null;
  upgrade_available: boolean;
  upgrade_check_error?: string;
  upgrade_command: string;
};

export type GitRunner = (args: string[], cwd: string) => Promise<string>;

export type PendingLogin = {
  created_at: number;
  redirect_uri: string;
  state: string;
  verifier: string;
};
