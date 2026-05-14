# Audio Brief

Use this action when the user asks for a podcast-like audio briefing, spoken
briefing, listening version, commute briefing, or long-form audio explanation
from FeedContext.

An Audio Brief is an agent-composed artifact definition rendered by `api`. It is
not feed-provided Episode Audio, not a FeedContext-hosted podcast, not a private
RSS feed, and not a web-authored resource. The agent owns Structured Synthesis,
the Show Script DSL, and review gates; `api` owns server-side Edge TTS
rendering, segment retry, final assembly, storage, viewing, and delivery.

This file is the default Audio Brief execution path. Load the child stage docs
only when that stage is active.

## Required Stages

1. Decide capacity before scripting when the request is organized,
   synthesized, explanatory, or editorial and no reviewed `.synthesis.json`
   already fixes the topic set. If the user has not specified capacity, first
   estimate the semantic topic count from the discovered candidate set using
   titles, summaries, source distribution, timestamps, and obvious duplicate or
   related-story clusters. Recommend the actual estimated count with an
   approximate runtime at about 30 seconds per Artifact Topic, then wait for
   user confirmation. Also offer useful alternatives such as a shorter priority
   edition, an expanded edition, or a near-full stream when they fit the
   request. If topic count and target runtime conflict, confirm the trade-off
   before writing the script.
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
   script-only handoff or Artifact Definition Bundle submission. A `ready`
   verdict is required.
   `revise` returns to script editing; `blocked` returns to missing evidence,
   scope, or user decisions.
7. If the user requested script-only mode, stop after preserving the reviewed
   Show Script JSON, readable script, and `ready` review note.
8. If audio is requested, pack the reviewed Structured Synthesis, Synthesis
   Review, Show Script DSL, Script Review, and render metadata into an Artifact
   Definition Bundle, then submit it with `feedcontext artifact
   submit-definition --artifact-type audio_brief --confirm`.
9. Preserve a Run Feedback note after script-only handoff or server render
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
- `audio-brief/providers.md` records the server-side Edge TTS provider boundary.
- `audio-brief/rendering.md` records the server render contract, segment retry,
  final assembly, Timed Script playback text, artwork, and Final Audio Review.
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
such as validating bundle shape or checking that Show Script turns reference
reviewed synthesis evidence. Do not delegate provider execution or final audio
assembly in the local agent environment; those belong to `api`.

## Local Helper Boundary

The Skill Local Helper may validate Show Script and bundle shape before
submission. It must not become the audio service connector, own provider
execution, reinterpret Feed Items, assemble final audio, or hide provider calls
inside local workflow mechanics.
