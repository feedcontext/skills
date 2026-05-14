# Audio Brief Script

Use this stage after Structured Synthesis exists and before audio generation.
Generate the Show Script from Structured Synthesis, not directly from Feed Item
text or freeform prose summaries.

## Script Principles

- Important script sections and turns should reference the Structured Synthesis
  units or evidence bundles they are based on.
- Order Artifact Topics for natural listening by default. Build the sequence
  around the listener's path to understanding: establish the largest context or
  highest-impact topic first, connect related topics with spoken transitions,
  and leave supplemental or lower-priority topics for later. Use chronological,
  Source-based, or importance-only ordering only when the user asks for that
  ordering or the evidence clearly requires it.
- For large capacities such as 50 or 100 Artifact Topics, do not default to one
  spoken segment per topic. Keep the listening experience coherent by giving
  major topics full treatment and combining lower-priority topics into fast
  roundup or appendix-style spoken sections.
- Set the target runtime from the selected Artifact Topic count. Use about 30
  seconds of average spoken time per Artifact Topic unless the user asks for a
  different depth or runtime; for example, 20 topics implies about 10 minutes,
  50 topics implies about 25 minutes, and 100 topics implies about 50 minutes.
  When the user gives both a topic count and a conflicting target runtime, use
  the runtime only after confirming whether they want faster coverage for all
  selected topics or fewer topics at normal depth.
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
- When the spoken script feels thin for the target runtime, deepen the selected
  topics instead of adding unrelated Feed Items. Add cause-and-effect context,
  listener relevance, number interpretation, uncertainty boundaries, host
  questions, and grounded reactions that help the listener understand why the
  selected topics matter.
- Open like a show before moving into the news hook. The opening should include
  a brief natural welcome, a spoken host self-introduction, and a short
  conversational greeting or handoff between hosts before the first news setup.
  After that, move quickly into the day's concrete tension, affected actors,
  decision, risk, or question. Do not lead the spoken script with how many Feed
  Items were scanned, which sidecar was used, or how the selection was made. Put
  those details in notes unless they are essential to the story.
- For two-host formats, the second host must do more than affirm or summarize.
  Use the second host as a listener proxy: ask short clarifying questions,
  challenge whether two stories really belong together, translate abstract
  stakes into practical consequences, or slow down a dense point before the
  narrative continues.
- Give two-host scripts human emotional texture when the topic allows it. Hosts
  may briefly react from a personal listener perspective, make restrained
  evaluations, laugh lightly, or use mild playful banter, especially around
  surprising, absurd, or everyday-impact stories. Keep this interaction compact,
  grounded in the news, and appropriate to the seriousness of the topic; never
  let jokes replace evidence, trivialize harm, or turn into generic filler.
- Translate numbers for listening. When the script uses large funding amounts,
  percentages, energy capacity, vulnerability counts, or timelines, add a short
  spoken explanation of why the number matters. Avoid stacking several raw
  figures in one turn without a plain-language consequence.
- Manage information density within the topic-derived target duration. Combine
  related lower-priority topics into clearly labeled quick-hit or appendix-style
  spoken sections when that improves listening flow, but do not leave selected
  Artifact Topics only in notes unless the user explicitly asks for a shorter
  runtime or a highlights-only audio brief.
- Keep evidence caution listener-friendly. If a topic depends on a single
  source or fast-moving reporting, say what remains unsettled in ordinary
  broadcast language. Do not narrate internal evidence-depth labels, review
  criteria, or audit-style caveats.
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
  labels unless the user explicitly requested a ranked list. Do not use
  report-like transitions such as "first main thread," "second main thread,"
  or "third item" merely to show structure. Prefer conversational bridges that
  follow the story's logic, such as moving from infrastructure pressure to
  financing, from regulation to safety, or from company news to supply-chain
  consequences. Use plain verbs, concrete nouns, short transitions, and natural
  conversational bridges appropriate to the spoken language.
- Do not use AI-flavored contrast templates in spoken text. In any language,
  repeated rhetorical structures equivalent to "not X, but Y", "the key is not
  X, but Y", "what matters is not X", or "this is less about X and more about Y"
  must be rewritten before review can pass. These patterns are allowed only
  when a real quoted source or concrete factual distinction requires them.
  Prefer direct news phrasing: say what happened, name the actors, then explain
  the consequence in ordinary words.
- Do not rely on meta-commentary hooks such as "the real signal is", "the
  bigger story is", "from a broader perspective", "the deeper logic is", or
  similar abstract framing. Replace them with the actual fact, pressure,
  decision, risk, or open question.
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
- Choose duration from the selected Artifact Topic count, actual Feed Items,
  information density, user request, and explanation needs rather than forcing a
  fixed runtime.

## Readable Script

Create a user-readable script Markdown file from the same Show Script. The
readable script should include source notes or a source appendix, including
whether each major section was grounded in key Feed Item content reads or only
title/Summary-level evidence. The spoken text itself should not verbally cite
sources, read URLs, or describe this evidence depth.

## Show Script Files

Keep these files together when practical:

```text
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.synthesis.json
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.script.json
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.script.md
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.segments.json
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.bing-edge.cover.png
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.bing-edge.lyrics.txt
/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.bing-edge.render-manifest.json
/tmp/feedcontext/2026-05-07-daily-audio/artifact-definition.json
```

Use `schemas/show-script.schema.json` as the generated schema artifact. If a
local schema helper is available, use it only as a deterministic local
validation aid.
Do not add Timed Script fields to the Show Script JSON. Timed Script playback
text is derived after audio rendering because it depends on the final audio
file, provider pacing, segment manifest, and intro or outro assembly.
The Show Script `title` should be preserved into the TTS segments file so final
audio rendering can embed it as the player-facing display title independently
from the output filename.

Minimum shape:

```json
{
  "schema_version": "1",
  "source_synthesis": {
    "file": "/tmp/feedcontext/2026-05-07-daily-audio/feedcontext-audio-brief-2026-05-07.synthesis.json"
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
      "provider_voice": "en-US-AvaNeural",
      "voice_persona_id": "bing-edge/en-US-AvaNeural"
    },
    {
      "id": "host_b",
      "name": "Host B",
      "role": "clarifier",
      "gender": "male",
      "voice": "curious, concise",
      "provider_voice": "en-US-GuyNeural",
      "voice_persona_id": "bing-edge/en-US-GuyNeural"
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
          "text": "Welcome back, I'm Host A. Host B is here with me today, and we'll ease in quickly before we get to the concrete moves that matter.",
          "synthesis_unit_ids": ["lead-ai-shift"],
          "emotion": "warm curiosity",
          "transition": "soft opening hook",
          "pacing": "measured"
        },
        {
          "speaker": "host_b",
          "text": "Good to be here. Let's start with the story that sets up the rest of the brief.",
          "synthesis_unit_ids": ["lead-ai-shift"],
          "emotion": "warm",
          "transition": "brief host greeting before news setup",
          "pacing": "conversational"
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

When `provider_voice` is omitted, the selected provider path should choose a
stable Voice Persona for the spoken language and host gender before rendering.
Host-level `provider_voice` remains the exact rendering voice and takes
precedence over provider defaults. Host-level `voice_persona_id` records which
fixed provider voice persona supplied the host name or voice metadata, while
`name` is the stable host name used for spoken self-introductions.
