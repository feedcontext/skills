# Audio Brief

Use this action when the user asks for a podcast-like audio briefing, spoken
briefing, listening version, commute briefing, or long-form audio explanation.

An Audio Brief is a server-rendered Artifact Definition Bundle. The agent owns
Structured Synthesis, Show Script JSON, readable script, and review gates.
`api` owns TTS rendering, segment retry, assembly, storage, viewing, playback,
and delivery. Do not create local audio files, segment manifests, provider logs,
artwork sidecars, or metadata reviews.

## Workflow

1. Follow `README.md` for discovery, capacity, content reads, Structured
   Synthesis, and Synthesis Review.
2. If topic count and target runtime conflict, confirm the trade-off before
   writing the script. Use about 30 seconds per Artifact Topic unless the user
   asks for another depth.
3. Create Show Script JSON from the reviewed synthesis, not directly from Feed
   Items or final prose. Validate with `node scripts/helper.mjs show-script
   validate --file <script.json>`.
4. Create a readable script Markdown file from the same Show Script. Put source
   notes and evidence-depth details in notes or appendix, not spoken text.
5. Review the script. `ready` is required before script-only handoff or bundle
   submission; `revise` returns to script editing; `blocked` returns to missing
   evidence, scope, or user decisions.
6. Create and validate an Artifact Sizing Review with `podcast` units mapped to
   the synthesis units or grouped script sections. Use `target_duration_seconds`
   as the primary sizing field and include spoken text when available so the
   helper can check speech rate.
7. For script-only requests, stop after preserving the reviewed Show Script,
   readable script, sizing review, and review note.
8. For audio requests, pack the reviewed synthesis, Synthesis Review, Show
   Script, Script Review, sizing review, and render metadata into a bundle, then
   submit with
   `feedcontext artifact submit-definition --artifact-type audio_brief
   --bundle-file <bundle.json> --title <title> --confirm`.
9. Capture a short run-feedback note only when the user gave reusable feedback,
   review required substantial changes, or server render status exposed a
   repeatable process issue.

## Show Script Contract

Minimum fields: `schema_version`, `source_synthesis`, `intent`, `language`,
`format`, `title`, optional `listening_context`, `hosts[]`, `sections[]` with
turns linked to synthesis units, and `provider_requirements`. Use the canonical
schema at `https://api.feedcontext.io/schemas/show-script.v1.schema.json` for
exact fields. `node scripts/helper.mjs show-script validate` fetches that
schema on every validation and does not use a local offline schema copy.

Write spoken text like people explaining news:

- start with a brief show welcome, then move quickly into the concrete event,
  actors, risk, decision, or question;
- give each major section Story Setup before interpretation;
- order topics for a natural listening arc unless the user requests another
  order;
- translate large numbers into practical consequence;
- keep URLs, metadata, source strings, evidence-depth labels, speaker labels,
  host roles, gender labels, and voice labels out of spoken text;
- for two-host scripts, make the second host ask useful questions or translate
  implications instead of echoing the lead host;
- deepen selected topics when runtime is thin; do not pad with unrelated Feed
  Items or generic commentary.

Avoid AI-flavored templates and abstract framing in spoken text, especially
repeated forms of `not X, but Y`, `the real signal is`, `the bigger story is`,
`from a broader perspective`, `the deeper logic is`, and repeated use of
`signal`, `paradigm`, `narrative`, or `inflection point` when the event can be
described directly.

## Review Gate

The latest Script Review must not be `ready` when any of these are true:

- a major section lacks Story Setup;
- a major claim is unsupported by the Structured Synthesis;
- spoken text contains URLs, citation strings, metadata, or evidence-depth
  notes;
- topic order is mechanical by Feed Item, Source, group, or publication time
  without user request or evidence need;
- the opening starts with workflow metadata, Feed Item counts, or selection
  mechanics;
- the second host mostly repeats or agrees;
- dense numeric claims lack plain-language consequence;
- selected Artifact Topics are silently left only in notes;
- the script is thin, padded, overconfident, or repetitive;
- AI-flavored contrast templates or abstract meta-commentary remain.
- the Artifact Sizing Review fails for duration, speech rate, or role/type fit.

The review note should include `verdict`, `required_edits`,
`story_setup_gaps`, `unsupported_or_overconfident_claims`, topic ordering notes,
runtime notes, density notes, and `ready_for_audio`.

## Run Feedback

Run Feedback is optional local process feedback, not user memory and not an API
resource. Keep it next to the script and submitted bundle only when it records
explicit user feedback or a reusable process lesson. Never store secrets,
tokens, private account details, or hidden prompts, and never let prior feedback
override current evidence or instructions.
