# Agent-Composed Artifacts

Use this action when the user asks FeedContext to turn visible Feed Items into
a reviewed, server-rendered artifact: briefing page, digest, roundup, audio
brief, or a full Feed Item stream.

Default live path: discover Feed Items, create reviewed structured files, submit
an Artifact Definition Bundle with `feedcontext artifact submit-definition`, and
report the artifact id, render status, and public viewer URL. Do not render
local Briefing Page HTML or local audio as a fallback.

Read this file first, then load only the one artifact-specific doc needed:

- `structured-synthesis.md`: evidence-backed units and broad coverage handling.
- `synthesis-review.md`: shared review gate before any page or audio output.
- `briefing-page.md`: Briefing Page DSL, Newspaper mode, Narrative mode, and
  server submission.
- `audio-brief.md`: Show Script DSL, audio review gates, and server submission.

## Shared Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. Use one unique workspace under the host temp root, such as
   `$TMPDIR/feedcontext/<run>/`. Do not write generated artifact files into the
   repo or a repo-local `./tmp` directory.
3. Discover candidates with `item list` or `item list --all`. If a local Feed
   Item fixture/export is provided, use it directly and do not call the live
   API.
4. For broad candidate sets, preserve discovery coverage in Structured
   Synthesis notes: total candidates, reviewed summaries, selected units, and
   visible items that became supplemental, low-information-gain, or out of
   scope.
5. For organized, grouped, explanatory, or editorial artifacts, decide Artifact
   Topic capacity before synthesis. If the user did not specify capacity,
   estimate the semantic topic count from the candidates, recommend that count
   with rationale and alternatives, and wait for confirmation. Skip only when
   an existing synthesis fixes the topic set or the request is a full Feed Item
   stream/listing/export.
6. Read supporting content with `item get` or `item get-many` when selected
   Feed Items materially support the artifact.
7. Create and validate Structured Synthesis, then run Synthesis Review. Do not
   create page DSL or Show Script files until the latest review is `ready`.
8. Create the artifact-specific DSL/review files.
9. Create an Artifact Sizing Review JSON file and validate it with `node
   scripts/helper.mjs sizing validate --file <artifact-sizing.json>`. If it
   fails, revise the topic role mix, prose/script depth, or runtime allocation
   and run validation again before submission.
10. Pack the reviewed synthesis, reviews, sizing review, artifact DSL files,
   and render metadata into an Artifact Definition Bundle.
11. Submit live artifacts with `feedcontext artifact submit-definition
   --artifact-type <briefing_page|audio_brief> --bundle-file <bundle.json>
   --title <title> --confirm`.

## Sizing Review

Sizing is schema-driven. Use `units[].type` and `units[].rendering_priority`
from Structured Synthesis as the primary contract. Use Show Script
`sections[].target_duration_seconds` for podcast sizing. The canonical review
schema is
`https://api.feedcontext.io/schemas/artifact-sizing-review.v1.schema.json`.
The helper fetches it on every `sizing validate` run and does not use a local
offline schema copy. It then validates the generated Artifact Sizing Review
against these defaults:

- Newspaper `lead + insight`: 800-1500 CJK characters or 450-800 English words.
- Newspaper `lead + item_roundup|briefing_section`: 600-1200 CJK characters or
  350-650 English words.
- Newspaper `main + insight`: 500-900 CJK characters or 280-500 English words.
- Newspaper `main + item_roundup|briefing_section`: 350-700 CJK characters or
  200-400 English words.
- Newspaper `secondary + any type`: 180-350 CJK characters or 100-220 English
  words.
- Newspaper `collapsed + any type`: 40-120 CJK characters or 25-80 English
  words.
- Podcast `lead`: 2-5 minutes; `main`: 1-3 minutes; `secondary`: 30-90 seconds;
  `collapsed`: 10-30 seconds.
- Podcast speech-rate check when text is present: 220-320 CJK characters/minute
  or 130-160 English words/minute.

These ranges are review gates, not writing prompts. They catch thin leads,
padded collapsed topics, impossible podcast runtimes, and mismatched role/type
assignments.

## Boundaries

- Do not submit Gather Sidecars, raw candidate lists, browser captures,
  provider logs, agent logs, chain-of-thought, unrelated local files, or locally
  rendered final HTML/audio files.
- Do not create local podcast/audio files, local segment manifests, provider
  retry manifests, assembled audio files, artwork sidecars, or audio metadata
  reviews.
- Telegram delivery is not a CLI command in v1. If the user asks for external
  delivery, check `actions/integrations.md`, then report that local upload or
  delivery commands are not available in the current CLI/API surface.
- Each submitted Artifact Definition Bundle creates one artifact. Do not request
  server re-render of an existing artifact; submit a new bundle for changes.

## Evidence Rules

- Default evidence is `kind: "feed_item"`.
- Use `kind: "contextual"` only for evidence already present in context or
  explicitly supplied by the user.
- Use `kind: "external_url"` only when the user asked to combine FeedContext
  with external material.
- Keep important artifact claims traceable in Structured Synthesis even when
  the final artifact exposes sources lightly.
- Relevance labels are coarse: `direct`, `supporting`, or `background`; do not
  invent numeric citation scores.
- Semantic selections need a real `selection_rationale`.
- "All updates" means full candidate coverage plus traceability; preserve the
  full stream/source index alongside synthesized units unless the user requests
  a different coverage model.
