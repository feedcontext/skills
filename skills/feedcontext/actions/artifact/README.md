# Agent-Composed Artifacts

Use these actions when the user asks FeedContext to turn visible Feed Items into
a server-rendered artifact. Artifacts are defined locally by the agent from the
user's visible Feed Items, then submitted to `api` as reviewed Artifact
Definition Bundles for rendering, viewing, and delivery.

Default to server submission for live FeedContext artifact requests. A request
such as "generate a page", "briefing page", "digest page", "roundup page", or
"convert updates to a page" means: create the reviewed DSL bundle, run
`feedcontext artifact submit-definition`, and report the artifact id, render
status, and private viewer URL. Local HTML rendering is only appropriate when
the user explicitly requests a local-only file, the workflow is fixture/offline,
or the live API/submit step is blocked and the blocker is reported.

Read this shared workflow first, then load only the artifact-specific doc that
matches the requested output.

## Shared Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. When a file is needed, create one unique session workspace under the host
   system temp root, for example `/tmp/feedcontext/2026-05-12-daily-briefing/`
   or `$TMPDIR/feedcontext/2026-05-12-daily-briefing/`. Do not write generated
   artifact files into the repo or a repo-local `./tmp` directory.
3. Discover candidates with `item list` or `item list --all`. If the user,
   host, or eval prompt provides a local Feed Item fixture/export, treat that
   file as the discovered candidate set and do not call the live API. Use
   structured filters such as time range, Subscription id, item ids, or keyword
   filters whenever possible.
4. For broad aggregation, create a Gather Sidecar with `gather.md` so all
   in-scope Summaries are reviewed before semantic selection.
5. For organized, grouped, explanatory, or editorial artifacts, decide the
   Artifact Topic capacity before synthesis. Offer 10, 20, 50, or 100 topics
   when the user has not specified capacity. Skip this when an existing
   Structured Synthesis sidecar already fixes the topic set.
6. If the user only asks for full Feed Item display, export, or listing, keep a
   Feed Item stream instead of forcing Artifact Topic synthesis or review.
7. Read supporting content with `item get` or `item get-many` when the selected
   Feed Items materially support the artifact.
8. Create and validate a Structured Synthesis sidecar with
   `structured-synthesis.md`, then run `synthesis-review.md`. Do not derive
   artifact-specific DSL files unless the latest Synthesis Review verdict is
   `ready`.
9. Create artifact-specific DSL files and matching Artifact Format Review files
   before submission. Keep the reviewed Structured Synthesis, reviews, DSL
   files, and final Artifact Definition Bundle together in the session
   workspace.
10. For live artifact requests, submit the reviewed bundle with
    `feedcontext artifact submit-definition`. Do not replace this with
    `helper.mjs artifact render-page` unless the user explicitly asked for a
    local-only file, the workflow is fixture/offline, or submission is blocked.

## Artifact Router

- `gather.md`: local Gather Sidecars before semantic Feed Item aggregation.
- `structured-synthesis.md`: shared evidence-backed synthesis stage.
- `synthesis-review.md`: required review before artifact-specific output.
- `combined-briefing.md`: dual-DSL Briefing Page definition and submission.
- `briefing-page.md`: Newspaper Briefing prose reference, only when needed.
- `narrative-briefing.md`: Narrative Briefing prose reference, only when
  needed.
- `audio-brief.md`: Audio Brief Show Script DSL, review, and server-render
  submission.

## Delivery

Submit reviewed Artifact Definition Bundles for server rendering:

   ```bash
   feedcontext artifact submit-definition \
     --artifact-type briefing_page \
     --bundle-file /tmp/feedcontext/2026-05-12-daily-briefing/briefing.bundle.json \
     --title "Daily Briefing" \
     --confirm
   ```

For Audio Briefs, submit the reviewed bundle and let `api` render audio through
the server-side Edge TTS Audio Renderer:

   ```bash
   feedcontext artifact submit-definition \
     --artifact-type audio_brief \
     --bundle-file /tmp/feedcontext/2026-05-12-daily-briefing/daily-audio.bundle.json \
     --title "Daily Audio Brief" \
     --confirm
   ```

Delivery remains explicit and user-approved after rendering is ready. Use the
returned artifact id only after the render status is `ready`:

   ```bash
   feedcontext artifact deliver-rendered \
     --id art_example \
     --caption "Daily Briefing" \
     --confirm
   ```

Do not submit Gather Sidecars, raw candidate lists, browser captures, provider
logs, agent logs, chain-of-thought, unrelated local files, or locally rendered
final HTML/audio files.

Do not treat local helper render output as the final answer for a live Briefing
Page request. If local rendering is also useful for validation, keep it beside
the sidecars, then still submit the reviewed DSL bundle unless one of the
local-only exceptions above applies.

Do not request a server re-render for an existing artifact. Each submitted
Artifact Definition Bundle creates one artifact; repeated generation or DSL
changes create a new artifact by submitting a new bundle.

## Evidence Rules

- Default evidence is `kind: "feed_item"`.
- Use `kind: "contextual"` only for evidence already present in the current
  agent context or explicitly supplied by the user.
- Use `kind: "external_url"` only when the user asked to combine FeedContext
  with external material.
- Important artifact claims should remain traceable in the Structured Synthesis
  sidecar even when the final artifact exposes sources lightly.
- Relevance labels are coarse: `direct`, `supporting`, or `background`. Do not
  invent numeric citation scores.
- Semantic selections need a real `selection_rationale`, especially when the
  agent includes, excludes, groups, or down-ranks Feed Items.
- Artifact Topic counts describe semantic topic units, not the number of Feed
  Items gathered or cited.
- Treat 10, 20, 50, and 100 Artifact Topics as fixed recommended capacity
  choices, not loose examples.
