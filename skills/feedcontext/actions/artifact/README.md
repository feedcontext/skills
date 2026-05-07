# Agent-Composed Artifacts

Use these actions when the user asks FeedContext to turn visible Feed Items into
a local artifact. Artifacts are composed by the agent from the user's visible
Feed Items; they are not Feed Items, not api resources, and not pages hosted by
`web`.

## Shared Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. Use `item list` or `item list --all` to discover candidate Feed Items. For
   Agent-Composed Feed Aggregation over multiple Feed Items, prefer creating a
   Gather Sidecar first with `gather.md` so all in-scope Summaries are reviewed
   before semantic selection.
3. Apply deterministic filters with structured fields when possible, such as
   time range, Subscription id, item ids, or keyword filters.
4. Use `item get` to read Feed Items that materially support the artifact.
5. Create a Structured Synthesis sidecar JSON file before rendering HTML,
   writing a script, or generating audio. Validate it with:

   ```bash
   node scripts/helper.mjs synthesis validate --file path/to/artifact.synthesis.json
   ```

6. Keep sidecar files next to the generated artifact when practical so evidence,
   selection rationale, and generation inputs remain inspectable.

Shared guidance covers discovery, deterministic filtering, Feed Item reading,
Structured Synthesis validation, evidence rules, selection rationale, and
sidecar preservation. Rendering and generation details live in the specific
artifact docs.

## Artifact Types

- Use `gather.md` for local Gather Sidecars before semantic Feed Item
  aggregation.
- Use `briefing-page.md` for local single-file HTML briefing pages.
- Use `audio-brief.md` for local Audio Brief scripts and generated audio.

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
