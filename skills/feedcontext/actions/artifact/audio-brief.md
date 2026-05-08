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
   Validate it with:

   ```bash
   node scripts/helper.mjs show-script validate --file path/to/audio-brief.script.json
   ```

3. Create a user-readable script Markdown file from the same Show Script. The
   readable script should include source notes or a source appendix, but the
   spoken text itself should not verbally cite sources or read URLs.
4. If the user requested script-only mode, stop after preserving the script
   files.
5. If the user requested audio or did not specify script-only mode, discover
   available audio generation paths and ask the user which one to use unless
   the user already specified a provider.
6. Generate audio through the selected provider path. Prefer one final
   listenable audio file. For long scripts, generate by section and preserve
   segment files plus an ordered manifest when useful.

## Script Principles

- Generate the Show Script from Structured Synthesis, not directly from Feed
  Item text or freeform prose summaries.
- Important script sections and turns should reference the Structured Synthesis
  units or evidence bundles they are based on.
- The spoken content should explain the story, context, and implications for
  listening. Do not make the audio a source-by-source recap, article read-aloud,
  or mechanical summary.
- Write the spoken text like people talking, not like a numbered report. Avoid
  rigid ordinal labels unless the user explicitly requested a ranked list. Use
  soft transitions, emotional texture, brief reactions, and natural
  conversational bridges appropriate to the spoken language.
- `speaker`, host names, roles, gender, and voice labels are script metadata.
  They must not be copied into spoken text. Do not generate audio that reads
  speaker labels, host labels, gender labels, or role labels aloud.
- Default to the user's requested language, or the current conversation language
  when no language is specified. Do not automatically follow Feed Item source
  language.
- Default to a two-host conversational format for longer listening: one host
  carries the narrative thread, while the other asks clarifying questions,
  draws contrasts, and translates implications for the user.
- Use a single host or sectioned format when the request, content, or expected
  listening length makes that clearer.
- Choose duration from the actual Feed Items, information density, user request,
  and explanation needs rather than forcing a fixed runtime.

## Show Script Files

Keep these files together when practical:

```text
feedcontext-audio-brief-2026-05-07.synthesis.json
feedcontext-audio-brief-2026-05-07.script.json
feedcontext-audio-brief-2026-05-07.script.md
feedcontext-audio-brief-2026-05-07.mp3
feedcontext-audio-brief-2026-05-07.segments.json
```

Use `schemas/show-script.schema.json` as the generated schema artifact and
`node scripts/helper.mjs show-script schema` as the helper-backed schema source.

Minimum shape:

```json
{
  "schema_version": "1",
  "source_synthesis": {
    "file": "feedcontext-audio-brief-2026-05-07.synthesis.json"
  },
  "intent": "script_then_audio",
  "language": "en-US",
  "format": "two_host",
  "title": "Daily Audio Brief",
  "listening_context": "morning commute",
  "hosts": [
    {
      "id": "host_a",
      "name": "Host A",
      "role": "narrative_lead",
      "gender": "female",
      "voice": "calm, clear, analytical",
      "provider_voice": "en-US-AvaNeural"
    },
    {
      "id": "host_b",
      "name": "Host B",
      "role": "clarifier",
      "gender": "male",
      "voice": "curious, concise",
      "provider_voice": "en-US-GuyNeural"
    }
  ],
  "sections": [
    {
      "id": "opening",
      "title": "Opening",
      "target_duration_seconds": 60,
      "synthesis_unit_ids": ["lead-ai-shift"],
      "turns": [
        {
          "speaker": "host_a",
          "text": "The most important part today is not one isolated headline. A few separate signals are starting to point in the same direction.",
          "synthesis_unit_ids": ["lead-ai-shift"],
          "emotion": "warm curiosity",
          "transition": "soft opening hook",
          "pacing": "measured"
        }
      ]
    }
  ],
  "provider_requirements": {
    "multi_voice": true,
    "long_form": true,
    "segment_generation": true,
    "preferred_output_format": "mp3"
  }
}
```

## Provider Discovery

FeedContext does not bind to one audio provider. When the user has not
specified a provider, discover options in this order:

1. Host agent skills or exposed tools that can generate audio.
2. Local CLIs or installed applications that can generate speech audio.
3. Configured external services available through environment variables or
   credentials.
4. Provider options the user could install or configure.

When more than one provider path is available, ask the user which one to use.
Present the trade-offs by listening quality, multi-host support, expected cost
or quota use, privacy boundary, and current local availability.

Selecting a third-party provider path allows the agent to send the Show Script
needed for this Audio Brief to that provider. For private or local-only
requests, use a local provider path or stop after script generation.

If no usable provider is available, the workflow should still complete the
Structured Synthesis and Show Script artifacts, then stop in a resumable
ready-to-generate-audio state.

## Provider Classes

Treat provider availability as more than a yes/no check:

- Production audio providers are external or host-agent paths intended for a
  podcast-like final output, such as a configured high-quality TTS or AI audio
  service. Before using one, disclose that the Show Script needed for this Audio
  Brief will be sent to that provider.
- Local fallback TTS paths, such as operating-system speech commands, are useful
  for drafts, previews, accessibility checks, or private local-only requests.
  Do not silently use a local fallback TTS path as the final podcast-like output
  when the user asked for a podcast or Audio Brief.
- Unavailable providers should leave the workflow in a resumable state with the
  Structured Synthesis, machine-readable Show Script, and readable script saved.

If a production provider is configured and the user has not specified a
provider, recommend that provider and state the privacy boundary. If multiple
production providers are configured, ask which one to use. If only local
fallback TTS is available, ask before generating audio from it.

When a provider supports voice or speaker selection, select voices that match
the script's spoken language. Do not read one language with a voice intended for
another language. Prefer passing the Show Script `language` into the helper with
`--language`; only pass `--voice` when the chosen provider voice is known to
support that spoken language.

For multi-host scripts, preserve each turn as a separate TTS segment and switch
voices by `speaker`. Use host `provider_voice` when present; otherwise let the
helper choose language-appropriate defaults by host `gender`. Do not flatten a
two-host script into one text file with speaker labels.

FeedContext's default TTS provider path is Bing Edge TTS through the helper's
built-in Edge Read Aloud client. It follows the same Microsoft Edge Read Aloud
API shape used by `MsEdgeTTS`, but the installable helper does not require a
separate Python package, external `edge-tts` CLI, or runtime `node_modules`. If
the user has not specified another provider, use Bing Edge TTS by default after
preserving the privacy boundary in the response or artifact notes.

## Provider Cookbook

Use provider-specific documentation before calling audio provider APIs directly.
This skill should grow concrete provider notes for configured production paths,
including required environment variables, voice discovery, text-to-speech
request shape, common error handling, segmentation, and output assembly.

At minimum, provider notes should cover:

- ElevenLabs: `ELEVENLABS_API_KEY` or `XI_API_KEY`, voice discovery, text to
  speech request shape, plan or quota errors, and long-script segmentation.
- OpenAI audio: `OPENAI_API_KEY`, model and voice selection, output format,
  errors, and long-script segmentation.
- Bing Edge TTS: bundled helper availability, voice selection, output format,
  external service boundary, and long-script segmentation.
- Local fallback TTS: platform command availability and the fact that local TTS
  is draft or preview quality unless the user explicitly accepts it.

Use helper diagnostics before rendering. Prefer helper-backed provider rendering
when it exists, and keep direct provider API calls as a fallback only when the
provider cookbook explicitly describes the call shape.

## Provider Doctor

Use provider diagnostics before asking the user to choose an Audio Brief
provider:

```bash
node scripts/helper.mjs audio provider doctor
node scripts/helper.mjs audio provider doctor --provider bing-edge
```

The doctor output reports provider availability, invocation shape, and the
privacy boundary for each provider path.

## Bing Edge TTS

Provider id: `bing-edge`

Default: yes

Bing Edge TTS uses the helper's built-in Edge Read Aloud client to call
Microsoft Edge's online text-to-speech service. The implementation follows the
same Microsoft Edge Read Aloud API shape used by `MsEdgeTTS`, but it is bundled
directly into `scripts/helper.mjs` so installed skills do not need a Python
package, an external `edge-tts` CLI, or runtime `node_modules`. It is still an
external provider path: the Show Script text needed for the Audio Brief is sent
to Microsoft's Edge online text-to-speech service. Availability is outside
FeedContext's control and may change.

Diagnostic:

```bash
node scripts/helper.mjs audio provider doctor --provider bing-edge
```

Helper-backed generation from a prepared spoken text file:

```bash
node scripts/helper.mjs audio render \
  --text-file feedcontext-audio-brief-2026-05-07.spoken.txt \
  --language en-US \
  --out feedcontext-audio-brief-2026-05-07.bing-edge.mp3
```

Convert a Show Script into speaker-aware TTS segments:

```bash
node scripts/helper.mjs audio segments \
  --script-file feedcontext-audio-brief-2026-05-07.script.json \
  --out feedcontext-audio-brief-2026-05-07.segments.json
```

For longer Audio Briefs, prefer segmented rendering so independent sections can
run concurrently and failed sections can be retried without regenerating the
whole show:

```bash
node scripts/helper.mjs audio render \
  --segments-file feedcontext-audio-brief-2026-05-07.segments.json \
  --out-dir feedcontext-audio-brief-2026-05-07-segments \
  --concurrency 4 \
  --language en-US \
  --intro-audio intro.mp3 \
  --outro-audio outro.mp3 \
  --final-out feedcontext-audio-brief-2026-05-07.bing-edge.mp3 \
  --out feedcontext-audio-brief-2026-05-07.bing-edge.segments.json
```

The segments file should contain the spoken `language` and an ordered
`segments` array:

```json
{
  "language": "en-US",
  "segments": [
    {
      "id": "opening-01",
      "speaker": "host_a",
      "text": "At first these stories look separate, but there is a shared thread underneath them.",
      "voice": "en-US-AvaNeural"
    },
    {
      "id": "opening-02",
      "speaker": "host_b",
      "text": "And that thread may matter more than any single headline on its own.",
      "voice": "en-US-GuyNeural"
    }
  ]
}
```

If `--voice` is omitted, Bing Edge TTS chooses a default voice from the script
language and host gender metadata.

Use intro and outro music when the user asks for a podcast-like final output and
music assets are available. The helper can prepend `--intro-audio` and append
`--outro-audio` while assembling `--final-out`. If music assets are not
available, preserve the speech segments and state that the final bed/jingle
asset is missing instead of pretending the audio has a podcast opening.

Use Bing Edge TTS as the default production audio provider when the user accepts
the external service boundary. For longer Audio Briefs, generate by section and
assemble the final audio file so a failed section can be retried without
regenerating the whole show.
