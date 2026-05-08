# Audio Brief Script Review

Use this stage after a Show Script JSON file and readable script Markdown file
exist, and before script-only handoff or audio rendering.

The review is a quality gate. It may be performed by a separate reviewer agent
when the host environment supports multi-agent orchestration. If no reviewer
agent is available, the current agent must perform the same review itself.

## Inputs

- The Structured Synthesis sidecar used to create the script.
- The machine-readable Show Script JSON file.
- The user-readable script Markdown file.
- Any explicit user preferences for language, tone, listening length, or format.

The reviewer should not rediscover Feed Items, change source selection, rewrite
Structured Synthesis, or invent new evidence. If the script cannot be fixed from
the available inputs, return it to the main agent with the missing requirement.

## Verdicts

Every review must produce exactly one verdict:

- `ready`: the reviewed script may be handed off in script-only mode or rendered
  into audio.
- `revise`: the script can be fixed from the existing synthesis and script
  inputs, but must return to Show Script editing before another review.
- `blocked`: the reviewer lacks required evidence, scope, user preference, or
  source material. Return control to the main agent; the reviewer must not fill
  the gap by inventing content.

Do not render audio or hand off a script-only final artifact unless the latest
review verdict is `ready`.

## Review Checklist

Check every major section for:

- Story Setup: the script says what happened, who or what is involved, and why
  the topic is being raised before interpretation.
- Evidence fit: important claims remain traceable to the synthesis units or
  evidence ids referenced by the turns.
- Natural news style: the script sounds like people explaining news, not an
  abstract insight essay, management memo, or model-generated summary.
- Low AI flavor: remove contrast templates, meta-commentary, and
  abstraction-heavy phrasing that frames ordinary events as signals, paradigms,
  narratives, or deep logic.
- Spoken clarity: each turn is easy to say aloud, with short enough sentences
  and no written-only formatting or citation strings in the spoken text.
- Host usefulness: in a two-host script, the second host asks real clarifying
  questions or adds useful perspective instead of echoing the first host.
- Source handling: source notes, evidence depth, URLs, and metadata stay in the
  readable script notes or appendix, not in spoken text.
- Scope control: remove filler, repeated conclusions, unsupported claims,
  overconfident predictions, and generic advice that does not follow from the
  synthesis.

## Hard Gates

The verdict must not be `ready` when any of these are true:

- A major news, risk, or trend section lacks Story Setup.
- A spoken turn contains source URLs, citation strings, metadata, or evidence
  depth notes that belong in readable script notes.
- The script contains AI-flavored contrast templates that can be rewritten as
  direct news explanation.
- The script repeatedly uses meta-commentary or abstraction-heavy framing where
  concrete news explanation would work.
- A major claim is unsupported by the Structured Synthesis.
- A section makes an overconfident prediction from weak evidence.
- The script has empty host banter, repeated conclusions, or filler that does
  not help the listener understand the news.

## Edit Rules

The reviewer may edit the script to:

- keep or sharpen factual Story Setup;
- remove AI-flavored phrasing, filler, and repeated abstractions;
- replace meta-commentary with direct news phrasing;
- shorten turns for spoken delivery;
- move source or evidence-depth details out of spoken text and into notes;
- preserve useful host contrast while removing empty banter.

The reviewer must not:

- add new claims that are not supported by the Structured Synthesis;
- change the user's requested language or format;
- change provider settings, voice metadata, or final audio rendering choices;
- silently drop a major synthesis unit without leaving a note for the main
  agent.

## Output

After review, preserve the reviewed Show Script JSON and readable Markdown
script. Include a short review note in the readable script or a sibling review
note file with:

- `verdict`: `ready`, `revise`, or `blocked`;
- `required_edits`: required changes before the next review, or an empty list;
- `removed_ai_flavor`: AI-flavored phrasing removed or still present;
- `story_setup_gaps`: sections that still need factual setup;
- `unsupported_or_overconfident_claims`: claims to remove, soften, or support;
- `ready_for_audio`: boolean, true only when `verdict` is `ready`.

The final spoken text should be the reviewed version only.

## Mechanical Phrase Scan

Before giving a `ready` verdict, scan the spoken text for recurring rhetorical
templates. If any pattern appears more than once, the verdict should normally be
`revise`. If one pattern appears once, keep it only when it expresses a concrete
factual distinction that would sound natural in ordinary speech.

Language-neutral patterns to scan for:

- `not X, but Y`
- `not only X, but also Y`
- `the key is not X`
- `what matters is not X`
- `this is less about X and more about Y`
- `the real signal is`
- `the bigger story is`
- `from a broader perspective`
- `the deeper logic is`
- repeated "signal", "paradigm", "narrative", "inflection point", or "structural
  shift" framing when the underlying event can be described directly

Rewrite by replacing the frame with the event and consequence. State the
concrete update first, then explain how distribution, adoption, risk,
customers, regulators, or affected users change because of it.
