# Agent-Composed Artifacts

Use these actions when the user asks FeedContext to turn visible Feed Items into
a local artifact. Artifacts are composed by the agent from the user's visible
Feed Items; they are not Feed Items, not api resources, and not pages hosted by
`web`.

## Shared Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. Before writing local files for this artifact session, create one unique
   session workspace under the host system temporary directory, for example
   `/tmp/feedcontext/2026-05-12-daily-briefing/`. Prefer the host-provided temp
   root, such as `$TMPDIR` when it is available, but do not use a repository
   relative `./tmp` folder. Put all generated session files there, including
   discovery exports, Gather Sidecars, Structured Synthesis sidecars, review
   notes, scripts, HTML pages, audio files, thumbnails, downloaded or generated
   assets, provider logs, and final deliverable files. Do not write temporary
   files or final artifacts directly into the current directory or repository
   root. Create the folder lazily only when there is a file to write.
3. Use `item list` or `item list --all` to discover candidate Feed Items. For
   Agent-Composed Feed Aggregation over multiple Feed Items, prefer creating a
   Gather Sidecar first with `gather.md` so all in-scope Summaries are reviewed
   before semantic selection.
4. Apply deterministic filters with structured fields when possible, such as
   time range, Subscription id, item ids, or keyword filters.
5. If the user asks the agent to organize, group, synthesize, explain, or
   editorially structure the artifact but does not specify capacity, ask how
   many Artifact Topics to include before creating the Structured Synthesis.
   Offer 10, 20, 50, or 100 topics, recommending 20 for a broad briefing unless
   the current request clearly calls for a smaller or larger result. Accept a
   custom topic count when the user provides one. Briefly explain that an
   Artifact Topic is a grouped topic, not a Feed Item count, and that multiple
   Feed Items about the same topic may merge into one Artifact Topic.
   Skip this prompt when the user supplies or selects an existing Structured
   Synthesis sidecar because that sidecar already fixes the artifact's topic
   set.
6. If the user only asks for full Feed Item display, export, or listing, keep a
   Feed Item stream instead of forcing Artifact Topic synthesis or Structured
   Synthesis review. Preserve the scope, deterministic filter, and source index
   clearly in the artifact.
7. Use `item get` to read one Feed Item, or `item get-many` to read several
   selected Feed Items with bounded local concurrency, when those Feed Items
   materially support the artifact.
8. Follow `structured-synthesis.md` to create, validate, and review a
   Structured Synthesis sidecar JSON file before rendering HTML, writing a
   script, or generating audio.

9. Keep sidecar files next to the generated artifact inside the session
   workspace so evidence,
   selection rationale, and generation inputs remain inspectable.

10. If the user asks to send the final page or audio to Telegram, first follow
   `../integrations.md` and confirm Telegram is connected. Then deliver only
   the final artifact file and its Structured Synthesis sidecar:

   ```bash
   feedcontext artifact deliver \
     --artifact-type briefing_page \
     --file /tmp/feedcontext/2026-05-12-daily-briefing/briefing.html \
     --synthesis-file /tmp/feedcontext/2026-05-12-daily-briefing/briefing.synthesis.json \
     --title "Daily Briefing" \
     --confirm
   ```

   For audio briefs, use the final `.m4a` or `.mp3` file:

   ```bash
   feedcontext artifact deliver \
     --artifact-type audio_brief \
     --file /tmp/feedcontext/2026-05-12-daily-briefing/daily-brief.m4a \
     --synthesis-file /tmp/feedcontext/2026-05-12-daily-briefing/daily-brief.synthesis.json \
     --title "Daily Audio Brief" \
     --telegram-audio-duration-seconds 603 \
     --telegram-audio-performer "FeedContext" \
     --telegram-audio-title "Daily Audio Brief" \
     --telegram-thumbnail-file /tmp/feedcontext/2026-05-12-daily-briefing/daily-brief.telegram-thumb.jpg \
     --caption "Today’s audio brief" \
     --confirm
   ```

   Telegram audio cards do not reliably read embedded M4A/MP3 duration, artwork,
   or artist metadata. Pass player-facing duration, title, performer, and a JPEG
   thumbnail explicitly when delivering Audio Briefs. Round the rendered audio
   duration up to the nearest whole second. The Telegram thumbnail must be JPEG,
   no larger than 320x320, and less than 200 KB.

   Delivery is explicit and user-approved. Do not upload drafts, Gather
   Sidecars, raw browser captures, provider logs, or unrelated local files.

Shared guidance covers discovery, deterministic filtering, Feed Item reading,
Structured Synthesis validation and review, evidence rules, selection
rationale, and sidecar preservation. Rendering and generation details live in
the specific artifact docs.

## Artifact Types

- Use `gather.md` for local Gather Sidecars before semantic Feed Item
  aggregation.
- Use `structured-synthesis.md` and `synthesis-review.md` for the shared
  evidence-backed stage before artifact-specific rendering.
- Use `briefing-page.md` for local single-file HTML briefing pages.
- Use `audio-brief.md` for local Audio Brief scripts and generated audio.
- Treat full Feed Item stream pages as an exception path inside the shared
  workflow and `briefing-page.md`, not as a separate artifact action doc.
- Use `artifact deliver` only after the final artifact exists and the
  Structured Synthesis sidecar has passed validation and review.

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
