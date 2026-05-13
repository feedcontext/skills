# Audio Brief

Use this action when the user asks for a podcast-like audio briefing, spoken
briefing, listening version, commute briefing, or long-form audio explanation
from FeedContext.

An Audio Brief is a local agent-composed artifact. It is not feed-provided
Episode Audio, not a FeedContext-hosted podcast, not a private RSS feed, and not
an api or web resource.
The final local audio file is the complete user-facing artifact. Server
delivery is an optional later submission step, not the point where the audio
becomes complete.

This file is the default Audio Brief execution path. Load the child stage docs
only when that stage is active.

## Required Stages

1. Decide capacity before scripting when the request is organized,
   synthesized, explanatory, or editorial and no reviewed `.synthesis.json`
   already fixes the topic set. Offer 10, 20, 50, or 100 Artifact Topics, with
   approximate runtimes of 5, 10, 25, or 50 minutes. If topic count and target
   runtime conflict, confirm the trade-off before writing the script.
2. Produce or reuse a reviewed Structured Synthesis sidecar. Follow
   `structured-synthesis.md` and `synthesis-review.md`. Do not start scripting
   unless the latest Synthesis Review verdict is `ready`.
3. If relevant prior Audio Brief feedback exists, read
   `audio-brief/run-feedback.md` and apply only adjustments that fit the
   current request and evidence.
4. Create a machine-readable Show Script JSON file from the reviewed synthesis,
   not directly from Feed Items or final prose. Follow `audio-brief/script.md`
   only for script-writing details. Validate the script:

   ```bash
   node scripts/helper.mjs show-script validate \
     --file /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.script.json
   ```

5. Create a user-readable script Markdown file from the same Show Script. Keep
   source notes and evidence-depth details in the readable script or appendix,
   not in spoken text.
6. Review the Show Script with `audio-brief/script-review.md` before
   script-only handoff or audio rendering. A `ready` verdict is required.
   `revise` returns to script editing; `blocked` returns to missing evidence,
   scope, or user decisions.
7. If the user requested script-only mode, stop after preserving the reviewed
   Show Script JSON, readable script, and `ready` review note.
8. If audio is requested, choose a provider with `audio-brief/providers.md`
   unless the user already specified one. Preserve the privacy boundary before
   sending Show Script text to any external provider.
9. Render through `audio-brief/rendering.md`: create a segment manifest, render
   resumable segment files when possible, assemble the final audio, embed
   player-facing metadata and Timed Script playback text, then run Final Audio
   Review. Do not deliver a final M4A unless review reports `ready` or
   `ready_repaired`.
10. Preserve a Run Feedback note after script-only handoff or final audio
    generation. Follow `audio-brief/run-feedback.md`.

## Stage Docs

- `structured-synthesis.md` covers the shared evidence-backed synthesis stage
  used by briefing pages, audio briefs, and future agent-composed artifacts.
- `synthesis-review.md` covers the required shared quality review before
  artifact-specific rendering or scripting.
- `audio-brief/script.md` covers script-writing details: Story Setup, evidence
  depth, spoken style, runtime scaling, and script file shape.
- `audio-brief/script-review.md` covers the required review checklist and
  review-note shape before script-only handoff or audio rendering.
- `audio-brief/providers.md` covers provider discovery, privacy boundaries, and
  provider selection.
- `audio-brief/rendering.md` covers segments, resume behavior, provider
  diagnostics, final assembly, Timed Script playback text, artwork, and Final
  Audio Review.
- `audio-brief/run-feedback.md` covers post-run feedback notes.
- `audio-brief/mechanical-delegation.md` covers the narrow cases where a host
  agent may delegate mechanical conversion, rendering, or validation work after
  the main agent has produced the synthesis and script.

## Delegation Boundary

Keep Feed Item discovery, content reading, Structured Synthesis, source
selection, and Show Script narrative decisions in the main agent context. These
stages carry user intent, evidence judgment, and narrative continuity.

Show Script review may be delegated to a reviewer agent when the host supports
multi-agent orchestration, but the reviewer must use the existing synthesis and
script as inputs rather than reopening source selection or evidence gathering.

Use delegation only for mechanical work with stable inputs and clear outputs,
such as converting an approved Show Script to segments, rendering independent
TTS segments, assembling audio, or checking generated files. If the host agent
environment does not support sub-agents or parallel worker orchestration, do
not force a split; run the workflow in the main agent instead.

## Local Renderer Boundary

The Skill Local Helper may provide deterministic mechanics for complete local
audio artifacts, such as converting a reviewed Show Script into a segment
manifest, deriving spoken playback text, assembling already-rendered provider
outputs, embedding or repairing metadata, and checking the final file. It must
not become the service connector, own provider choice, reinterpret Feed Items,
or hide provider execution behind FeedContext-owned business logic.
