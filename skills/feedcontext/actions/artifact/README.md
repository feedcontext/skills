# Agent-Composed Artifacts

Use these actions when the user asks FeedContext to turn visible Feed Items into
a local artifact. Artifacts are composed by the agent from the user's visible
Feed Items; they are not Feed Items, not api resources, and not pages hosted by
`web`.

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
   `structured-synthesis.md`, then run `synthesis-review.md`. Do not render
   HTML, write an Audio Brief script, or generate audio unless the latest
   Synthesis Review verdict is `ready`.
9. Keep sidecars, review notes, scripts, pages, audio files, assets, provider
   logs, and final deliverables together in the session workspace.

## Artifact Router

- `gather.md`: local Gather Sidecars before semantic Feed Item aggregation.
- `structured-synthesis.md`: shared evidence-backed synthesis stage.
- `synthesis-review.md`: required review before artifact-specific output.
- `combined-briefing.md`: primary local dual-mode HTML Briefing Page.
- `briefing-page.md`: Newspaper Briefing prose reference, only when needed.
- `narrative-briefing.md`: Narrative Briefing prose reference, only when
  needed.
- `audio-brief.md`: Audio Brief script, review, provider, rendering, and final
  audio gates.

## Delivery

If the user asks to send the final page or audio to Telegram, first follow
`../integrations.md` and confirm Telegram is connected. Then deliver only the
final artifact file and its reviewed Structured Synthesis sidecar:

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
thumbnail explicitly when delivering Audio Briefs. Round duration up to the
nearest whole second. The Telegram thumbnail must be JPEG, no larger than
320x320, and less than 200 KB.

Delivery is explicit and user-approved. Do not upload drafts, Gather Sidecars,
raw browser captures, provider logs, or unrelated local files.

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
