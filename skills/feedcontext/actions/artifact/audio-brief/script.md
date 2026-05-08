# Audio Brief Script

Use this stage after Structured Synthesis exists and before audio generation.
Generate the Show Script from Structured Synthesis, not directly from Feed Item
text or freeform prose summaries.

## Script Principles

- Important script sections and turns should reference the Structured Synthesis
  units or evidence bundles they are based on.
- For each major news or analysis section, write the spoken Story Setup before
  the insight: first say what happened, who or what is involved, and why this
  topic is being raised now; then move into implications, synthesis, or
  recommendations. Do not open a section with only a headline list and a
  conclusion.
- For mainline news, risk, or trend claims, base Story Setup on the key Feed
  Item content reads, not only the Feed Item title or Summary. Titles and
  Summaries are acceptable for lightweight lists, weekend picks, or low-signal
  background items, but read the content before making a clear recommendation
  or interpretation.
- For roundup sections that cover multiple Feed Items, give each important item
  at least a compact factual setup before grouping them into a shared theme.
  If an item is only useful as background, make that role clear instead of
  pretending it supports the main insight.
- The spoken content should explain the news in a normal human broadcast style:
  lead with the concrete event, add the useful context, then say why it matters.
  Do not make the audio a source-by-source recap, article read-aloud,
  mechanical summary, or abstract insight monologue.
- When a claim relies on identifiable reporting, include a brief spoken source
  attribution in natural language. Mention the reporting outlet or outlets
  compactly to strengthen factual authority, especially for high-impact claims
  or claims corroborated by multiple sources. Do not read URLs, publication
  metadata, or full citation strings aloud.
- Keep evidence-depth details in the readable script notes or source appendix.
  The audio should not say whether a point came from a content read, title, or
  Summary unless that distinction is itself part of the story.
- Write the spoken text like people talking about news, not like a numbered
  report, management memo, or AI-generated insight essay. Avoid rigid ordinal
  labels unless the user explicitly requested a ranked list. Use plain verbs,
  concrete nouns, short transitions, and natural conversational bridges
  appropriate to the spoken language.
- Avoid AI-flavored contrast templates and meta-commentary, especially repeated
  phrasing like "this is not X, but Y", "the key is not X, but Y", "what matters
  is not the headline", "the real signal is", or "from a broader perspective".
  Use direct news phrasing instead: say what happened, then explain the
  consequence in ordinary words.
- Avoid abstraction-heavy language in any spoken language unless the source
  material itself is about that abstraction. Do not repeatedly frame ordinary
  events as insights, signals, paradigms, narratives, deep logic, boundary
  shifts, or similar high-level labels. Prefer concrete newsroom phrasing:
  describe the event, name the affected people or organizations, explain the
  immediate consequence, and state what remains uncertain.
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

## Readable Script

Create a user-readable script Markdown file from the same Show Script. The
readable script should include source notes or a source appendix, including
whether each major section was grounded in key Feed Item content reads or only
title/Summary-level evidence. The spoken text itself should not verbally cite
sources, read URLs, or describe this evidence depth.

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
