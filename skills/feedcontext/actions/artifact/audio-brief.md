# Audio Brief

Use this action when the user asks for a podcast-like audio briefing, spoken
briefing, listening version, commute briefing, or long-form audio explanation
from FeedContext.

An Audio Brief is a local agent-composed artifact. It is not feed-provided
Episode Audio, not a FeedContext-hosted podcast, not a private RSS feed, and not
an api or web resource.

## Workflow Map

```text
Feed Items
   |
   v
Shared Structured Synthesis stage
   |
   v
Show Script JSON + readable script <------.
   |                                      |
   v                                      |
Script Review gate --revise---------------'
   |
   v
Reviewed script artifact
   |----------------------.
   |                      |
   v                      v
script-only handoff   provider selection
   |                      |
   '----------.           v
              '----> TTS segments
                        |
                        v
         final audio with bundled intro/outro
                        |
                        v
               Run Feedback note
```

## Workflow

1. Follow `structured-synthesis.md` through Structured Synthesis creation,
   validation, and Synthesis Review, or start from an existing reviewed
   `.synthesis.json` sidecar when the user wants to turn an existing briefing
   into audio. If relevant prior Audio Brief feedback exists, read
   `audio-brief/run-feedback.md` and apply only adjustments that fit the
   current request and evidence.
2. Confirm the latest Synthesis Review verdict from `synthesis-review.md` is
   `ready` before scripting starts. `revise` returns to synthesis editing;
   `blocked` returns to the main agent for missing evidence, scope, content
   reads, or user decisions.
3. Create a machine-readable Show Script JSON file before generating audio.
   Follow `audio-brief/script.md`, then validate it with:

   ```bash
   node scripts/helper.mjs show-script validate --file path/to/audio-brief.script.json
   ```

4. Create a user-readable script Markdown file from the same Show Script. Keep
   source notes and evidence-depth details in that readable script, not in the
   spoken text.
5. Review the Show Script before audio generation or script-only handoff. Follow
   `audio-brief/script-review.md`. Use a separate reviewer agent when the host
   environment supports it; otherwise the current agent must self-review with
   the same checklist. The review must produce a `ready` verdict before the
   workflow can continue. `revise` returns to Show Script editing; `blocked`
   returns to the main agent for missing evidence, scope, or user decisions.
6. If the user requested script-only mode, stop only after preserving the
   reviewed files and a `ready` review note. The reviewed script can later
   continue into provider selection and rendering through
   `audio_from_existing_script`.
7. If the user requested audio or did not specify script-only mode, follow
   `audio-brief/providers.md` to discover available provider paths and ask the
   user which one to use unless the user already specified a provider.
8. Generate audio through the selected provider path. Follow
   `audio-brief/rendering.md` for segments, provider diagnostics, and final
   assembly. Podcast-like final outputs use the bundled intro and outro music
   unless the user explicitly asks for speech-only output or supplies custom
   assets.
9. Preserve a Run Feedback note after script-only handoff or final audio
   generation. Follow `audio-brief/run-feedback.md`.

## Stage Docs

- `structured-synthesis.md` covers the shared evidence-backed synthesis stage
  used by briefing pages, audio briefs, and future agent-composed artifacts.
- `synthesis-review.md` covers the required shared quality review before
  artifact-specific rendering or scripting.
- `audio-brief/script.md` covers Show Script creation, Story Setup, evidence
  depth, spoken style, and script file conventions.
- `audio-brief/script-review.md` covers the required quality review before
  script-only handoff or audio rendering.
- `audio-brief/providers.md` covers provider discovery, provider classes,
  privacy boundaries, and provider selection.
- `audio-brief/rendering.md` covers helper commands, segments, Bing Edge TTS,
  and final audio assembly.
- `audio-brief/run-feedback.md` covers post-run feedback notes that future
  Audio Brief runs may read before creating a new script.
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
