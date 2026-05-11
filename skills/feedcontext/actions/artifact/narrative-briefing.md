# Narrative Briefing — Prose Reference

This is a prose-style reference for the **Narrative Briefing** rendering mode
within a combined Briefing Page. For the primary workflow (discovery,
Structured Synthesis, review, mode selection, delivery), see
`combined-briefing.md`.

The Narrative Briefing dissolves Artifact Topics into one continuous polished
magazine-feature prose. The starting template is at
`templates/combined-briefing.html`.

## Editorial Shape

A single-column magazine article reading experience:

- a masthead at the top with the page title, date, theme, and scope (shared
  with Newspaper mode);
- one continuous flowing narrative that weaves Feed Items across Artifact
  Topics into a cohesive long-form piece;
- polished magazine-feature prose for silent reading, not spoken-voice script;
- drop-cap section breaks at topic transitions, signaling the shift while
  maintaining reading flow;
- inline rich-text source citations woven naturally into the prose;
- interspersed editorial figure/images where they enhance the narrative;
- a footer area with a complete source index (shared with Newspaper mode).

The narrative should read like a magazine feature: authoritative voice, varied
sentence length, natural rhythm. Avoid oral tics (no "you see", "let me tell
you"), no host turns, no pacing marks, no audio delivery markers. This is
written prose for a reader, not a transcript for a speaker.

## Prose Structure

### Sequencing

`rendering_priority` from the Structured Synthesis drives sequence:

- **Lead topics** open the narrative with the deepest coverage. Give them the
  most words and the strongest framing. They set the hook.
- **Main topics** fill the middle of the piece. Cover them with substance but
  at a slightly tighter pace than the lead.
- **Secondary topics** get briefer treatment toward the end. One to two
  paragraphs each.
- **Collapsed topics** appear as a brief "Also of note" paragraph before the
  source index.

### Topic Transitions

Artifact Topics dissolve into a single flowing piece. Write natural prose
bridges between topics, even when they span unrelated domains. Examples:

- "Meanwhile, in the AI space..."
- "The same week brought a different story from the regulatory front..."
- "Shifting gears to platform news..."

Open the first paragraph after each topic shift with a drop-cap (use the
`.drop-cap` CSS class). The drop-cap signals "new topic" without breaking the
reading flow.

### Source Citations

Cite sources inline as rich-text annotations within the prose. Instead of a
separate source-mark block, weave attribution naturally:

> Reporting from Stratechery suggests the shift began in early Q2...

Use `<a>` tags with the supporting Feed Item's URL. Style with `.inline-source`
for visual distinction. Every claim traceable to a Feed Item should carry at
least one inline citation near the point of use.

### Supplemental Items

- **`supplemental` secondary items**: Include as a brief "Also of note"
  paragraph near the end of the narrative. One sentence per item, still with
  inline source links.
- **`low_information_gain` and `out_of_scope` secondary items**: Skip
  entirely from the narrative prose. They appear only in the footer source
  index.

## Images

Same guidance as Newspaper mode (see `briefing-page.md#images`). In Narrative
mode, place figures between prose sections as editorial illustrations. Use
`<figure>` with `<figcaption>`. Intersperse sparingly — the prose is the
primary medium.

## What to Avoid

- Do not write host turns, pacing marks, or spoken-voice direction. Those
  belong in a Show Script for Audio Briefs.
- Do not use conversationalisms, direct audience address, or oral rhythm.
- Do not produce a flat list of items disguised as prose. Connect items with
  genuine narrative transitions.
- Do not create section headers within the narrative. Topic shifts use drop-cap
  prose bridges, not headings.
