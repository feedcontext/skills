# Audio Brief

Use this action when the user asks for a podcast-like audio briefing, spoken
briefing, listening version, commute briefing, or long-form audio explanation
from FeedContext.

An Audio Brief is a local agent-composed artifact. It is not feed-provided
Episode Audio, not a FeedContext-hosted podcast, not a private RSS feed, and not
an api or web resource.

## Workflow

1. Follow `README.md` in this directory through Structured Synthesis creation
   and validation, or start from an existing `.synthesis.json` sidecar when the
   user wants to turn an existing briefing into audio.
2. Create a machine-readable Show Script JSON file before generating audio.
   Follow `audio-brief/script.md`, then validate it with:

   ```bash
   node scripts/helper.mjs show-script validate --file path/to/audio-brief.script.json
   ```

3. Create a user-readable script Markdown file from the same Show Script. Keep
   source notes and evidence-depth details in that readable script, not in the
   spoken text.
4. If the user requested script-only mode, stop after preserving the script
   files.
5. If the user requested audio or did not specify script-only mode, follow
   `audio-brief/providers.md` to discover available provider paths and ask the
   user which one to use unless the user already specified a provider.
6. Generate audio through the selected provider path. Follow
   `audio-brief/rendering.md` for segments, provider diagnostics, and final
   assembly.

## Stage Docs

- `audio-brief/script.md` covers Show Script creation, Story Setup, evidence
  depth, spoken style, and script file conventions.
- `audio-brief/providers.md` covers provider discovery, provider classes,
  privacy boundaries, and provider selection.
- `audio-brief/rendering.md` covers helper commands, segments, Bing Edge TTS,
  and final audio assembly.
- `audio-brief/mechanical-delegation.md` covers the narrow cases where a host
  agent may delegate mechanical conversion, rendering, or validation work after
  the main agent has produced the synthesis and script.

## Delegation Boundary

Keep Feed Item discovery, content reading, Structured Synthesis, source
selection, and Show Script narrative decisions in the main agent context. These
stages carry user intent, evidence judgment, and narrative continuity.

Use delegation only for mechanical work with stable inputs and clear outputs,
such as converting an approved Show Script to segments, rendering independent
TTS segments, assembling audio, or checking generated files. If the host agent
environment does not support sub-agents or parallel worker orchestration, do
not force a split; run the workflow in the main agent instead.
