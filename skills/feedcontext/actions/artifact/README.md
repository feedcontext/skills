# Server-Composed Artifacts

Use this action when the user asks FeedContext to turn visible Feed Items into
a briefing page, digest, roundup, audio brief, or podcast-like artifact.

The Skill submits one Artifact Composition Request. `api` owns data retrieval,
topic grouping, per-stage review, Artifact Definition generation, rendering,
storage, status, and the public viewer URL. The Skill must not create local
Structured Synthesis, Show Script, sizing review, artifact definition JSON,
HTML, podcast/audio files, segment manifests, provider logs, or local final
artifacts.

Read this file first, then load only the artifact-specific doc needed:

- `briefing-page.md`: submit a `briefing_page` composition request.
- `audio-brief.md`: submit an `audio_brief` composition request.

## Shared Workflow

1. Run `feedcontext version` first if this is the first FeedContext action in
   the session.
2. Run `feedcontext auth status` before live workflows. Use the auth action doc
   if the local Skill Session is missing or stale.
3. Convert the user's request into composition scope only: `--request`,
   optional `--language`, optional `--query`, optional `--subscription-id`,
   optional `--item-id`, optional time window, optional `--target-topics`, and
   optional `--preference`.
4. Submit with `feedcontext artifact compose --artifact-type
   <briefing_page|audio_brief> --request <text> --confirm`.
5. Report the returned artifact id, current status, and public viewer URL. If
   the artifact is still composing or rendering, the viewer page is the user
   surface; do not expose internal workflow stages.

## Scope Rules

- If the user already gave exact Feed Item ids, Subscription ids, query, time
  window, language, or topic/runtime capacity, pass those values through.
- If the request is broad, submit the broad request. Do not pre-group items
  locally just to make the backend request cleaner.
- If the user asks for a full stream/listing/export, use Feed Item actions
  instead of forcing an organized artifact.
- User memory or preferences may be passed as `--preference` notes, but do not
  include secrets, hidden prompts, chain-of-thought, local file paths, or local
  temporary artifact names.

## Boundaries

- No local generation stages: the Skill does not create Structured Synthesis,
  Synthesis Review, Show Script, Script Review, sizing review, or artifact
  definition files.
- No local rendering: the Skill does not write Briefing Page HTML or podcast
  audio as a fallback.
- No workflow internals in user output: while generation is running, say it is
  generating and provide the viewer URL.
- Telegram delivery is not a CLI command in v1. If the user asks for external
  delivery, check `actions/integrations.md`, then report the available
  integration status without inventing upload commands.
