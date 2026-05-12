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
   |----------------------.--------------------------.
   |                      |                          |
   v                      v                          v
script-only handoff   provider selection       artwork base generation
   |                      |                   (agent image or template)
   '----------.           v                          |
              '----> TTS segments                    |
                        |                             |
                        v                             |
         final audio with bundled intro/outro <-------'
                        |
                        v
     branded Artwork + embedded Timed Script
                        |
                        v
        Final Audio Review gate --repair in place
                        |
                        v
               Run Feedback note
```

## Workflow

1. If the user asks for an organized, synthesized, explanatory, or editorial
   Audio Brief but does not specify capacity, ask how many Artifact Topics to
   include before scripting. Offer 10, 20, 50, or 100 topics, recommending 20
   for a broad briefing unless the request clearly needs a smaller or larger
   result. Accept a custom topic count when the user provides one. Briefly
   explain that an Artifact Topic is a grouped topic, not a Feed Item count, and
   that multiple Feed Items about the same topic may merge into one Artifact
   Topic. Include the estimated runtime in the prompt: about 5, 10, 25, or 50
   minutes for 10, 20, 50, or 100 Artifact Topics respectively, based on about
   30 seconds per topic on average. Skip this prompt when the user supplies or
   selects an existing Structured Synthesis sidecar because that sidecar already
   fixes the audio brief's topic set. If the user only asks for a full Feed Item
   listing in audio form, preserve that listing intent instead of forcing
   Artifact Topic synthesis or Structured Synthesis review.
   For large capacities such as 50 or 100 Artifact Topics, tell the user that
   the Audio Brief will cover the topic set through major segments plus fast
   roundup or appendix-style sections, and that the estimated runtime will grow
   with the selected capacity at about 30 seconds per Artifact Topic on average
   unless they ask for a different depth or runtime.
   If the user gives both an Artifact Topic count and a conflicting target
   runtime, do not silently compress the script. Confirm whether they want
   faster coverage for all selected topics or fewer topics at normal depth.
2. Follow `structured-synthesis.md` through Structured Synthesis creation,
   validation, and Synthesis Review, or start from an existing reviewed
   `.synthesis.json` sidecar when the user wants to turn an existing briefing
   into audio. If relevant prior Audio Brief feedback exists, read
   `audio-brief/run-feedback.md` and apply only adjustments that fit the
   current request and evidence.
3. Confirm the latest Synthesis Review verdict from `synthesis-review.md` is
   `ready` before scripting starts. `revise` returns to synthesis editing;
   `blocked` returns to the main agent for missing evidence, scope, content
   reads, or user decisions.
4. Create a machine-readable Show Script JSON file before generating audio.
   Follow `audio-brief/script.md`, then validate it with:

   ```bash
   node scripts/helper.mjs show-script validate \
     --file /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.script.json
   ```

5. Create a user-readable script Markdown file from the same Show Script. Keep
   source notes and evidence-depth details in that readable script, not in the
   spoken text. Write the Show Script JSON, readable script, review notes,
   rendered audio, artwork, thumbnails, manifests, and feedback note inside the
   artifact session workspace.
6. Review the Show Script before audio generation or script-only handoff. Follow
   `audio-brief/script-review.md`. Use a separate reviewer agent when the host
   environment supports it; otherwise the current agent must self-review with
   the same checklist. The review must produce a `ready` verdict before the
   workflow can continue. `revise` returns to Show Script editing; `blocked`
   returns to the main agent for missing evidence, scope, or user decisions.
7. If the user requested script-only mode, stop only after preserving the
   reviewed files and a `ready` review note. The reviewed script can later
   continue into provider selection and rendering through
   `audio_from_existing_script`.
8. After the reviewed script artifact exists, start Audio Brief Artwork base
   generation in parallel with provider selection and TTS segment preparation
   when the host environment supports parallel work. If the host agent has any
   configured image-generation capability that can produce a local image file,
   create an unbranded, text-free square base image from the reviewed script and
   synthesis context, save it as `*.artwork-base.png` or `*.artwork-base.jpg`,
   and pass it to rendering with `--artwork-file`. The capability may be native,
   plugin-backed, externally configured, or CLI-backed; do not require a
   specific tool name. If the host cannot generate and hand off a local image
   file, use a simple text-free local template or continue without generated
   artwork. Final brand overlay and audio embedding happen during rendering.
9. If the user requested audio or did not specify script-only mode, follow
   `audio-brief/providers.md` to discover available provider paths and ask the
   user which one to use unless the user already specified a provider.
10. Generate audio through the selected provider path using segment manifests,
   resumable segment files, and deterministic final assembly whenever the
   provider path supports it. Follow `audio-brief/rendering.md` for segments,
   provider diagnostics, final assembly, branded Audio Brief Artwork, and
   embedded Timed Script playback text. Podcast-like final outputs use the
   bundled intro and outro music unless the user explicitly asks for speech-only
   output or supplies custom assets.
11. Run Final Audio Review against the final M4A file before user delivery.
   The review must verify embedded player-facing metadata, embedded cover
   artwork, and embedded Timed Script playback text. It may repair the same M4A
   file in place using the render manifest and sidecars, but sidecars alone do
   not pass the gate. Follow `audio-brief/rendering.md`.
12. Preserve a Run Feedback note after script-only handoff or final audio
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
- `audio-brief/rendering.md` covers provider diagnostics, segments, provider
  paths, final audio assembly, embedded Timed Script playback text, and Final
  Audio Review.
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

## Local Renderer Boundary

The Skill Local Helper may provide deterministic mechanics for complete local
audio artifacts, such as converting a reviewed Show Script into a segment
manifest, deriving spoken playback text, assembling already-rendered provider
outputs, embedding or repairing metadata, and checking the final file. It must
not become the service connector, own provider choice, reinterpret Feed Items,
or hide provider execution behind FeedContext-owned business logic.
