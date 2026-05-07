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
  "language": "zh-CN",
  "format": "two_host",
  "title": "今日早间简报",
  "listening_context": "morning commute",
  "hosts": [
    {
      "id": "host_a",
      "name": "主持人 A",
      "role": "narrative_lead",
      "voice": "calm, clear, analytical"
    },
    {
      "id": "host_b",
      "name": "主持人 B",
      "role": "clarifier",
      "voice": "curious, concise"
    }
  ],
  "sections": [
    {
      "id": "opening",
      "title": "开场",
      "target_duration_seconds": 60,
      "synthesis_unit_ids": ["lead-ai-shift"],
      "turns": [
        {
          "speaker": "host_a",
          "text": "今天最值得注意的，不是一条单独新闻，而是几个信号正在指向同一个变化。",
          "synthesis_unit_ids": ["lead-ai-shift"],
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
