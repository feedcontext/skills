# Combined Briefing Page

Use this action when the user asks for a digest, briefing, recap, roundup, or
summary from FeedContext. This is the primary briefing page action; see
`briefing-page.md` and `narrative-briefing.md` for mode-specific prose guidance.

The output is a single-file local HTML page that contains both a **Newspaper
Briefing** and a **Narrative Briefing** rendering, toggled by a header switch.

## Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. Use `item list` or `item list --all` to discover candidate Feed Items.
3. If the user asks for an organized, grouped, synthesized page but does not
   specify capacity, ask how many Artifact Topics to include. Offer 10, 20, 50,
   or 100 topics, recommending 20 for a broad briefing.
4. Use `item get` for one item or `item get-many` for several selected Feed
   Items that materially support the page.
5. Follow `structured-synthesis.md` to create, validate, and review a
   Structured Synthesis sidecar JSON file before writing prose or HTML.
6. Curate the page around the user's request. If the user does not give a
   precise scope, choose a coherent recent theme from visible Feed Items, but
   record the selection rule in the Structured Synthesis.
7. If the page uses images, create an `assets/` directory inside the artifact
   session workspace and copy, download, or generate the image files there
   before referencing them from the HTML.
8. Write one standalone `.html` file with embedded CSS inside the artifact
   session workspace, using
   `templates/combined-briefing.html` as the starting scaffold.

## Dual-Mode Output

The combined briefing page contains two rendering modes in one file:

- **Newspaper Briefing**: See `briefing-page.md` for editorial shape and prose
  guidance. Renders Artifact Topics as independent modules in a multi-column
  editorial grid with a masthead, figures, pull quotes, and compact source
  marks.

- **Narrative Briefing**: See `narrative-briefing.md` for editorial shape and
  prose guidance. Dissolves Artifact Topics into one continuous polished
  magazine-feature prose with inline rich-text source citations and drop-cap
  section breaks between topic shifts.

Both modes share the same masthead, footer source index, and Structured
Synthesis sidecar. A header toggle switch lets the reader flip between modes,
persisting the preference in session storage.

## Mode Selection

When the user's preference is clear from keywords, pick the dominant mode:

- **Newspaper keywords**: grid, layout, visual, columns, newspaper, magazine
- **Narrative keywords**: narrative, long-form, story, prose, flowing, article

When the user just says "briefing" without any distinguishing keywords, ask
which mode they prefer. If the user says they don't care, produce the combined
dual-mode page (both modes in one file).

## Prose Approach Per Mode

You write two prose versions per Artifact Topic. In the HTML, each topic unit
contains both a `.newspaper-module` (compact module for the grid) and a
`.narrative-prose` block (flowing text for the narrative view). The toggle
switch shows one set and hides the other.

### Newspaper Module

For each Artifact Topic, write a compact module: a headline, one or two
paragraphs of dense summary, and a source mark listing the supporting Feed
Items. Follow `briefing-page.md` for editorial voice.

### Narrative Prose

For each Artifact Topic, write substantive prose that flows into the next
topic. `rendering_priority` drives sequence: lead topics open the narrative
with deeper coverage, main topics fill the middle, secondary and collapsed
topics get briefer treatment toward the end. Between topic shifts, open the new
section with a drop-cap paragraph and a prose bridge (e.g., "Meanwhile, in the
AI space..."). Inline source citations are woven naturally into the text as
rich-text annotations. Follow `narrative-briefing.md` for editorial voice.

## Starting Template

Use `templates/combined-briefing.html` as the starting scaffold. Adapt the
template to the user's request: fill in the masthead theme, deck, and date;
write Newspaper modules into `.newspaper-module` containers inside
`[data-mode-content="newspaper"] > .grid`; write Narrative prose into
`.narrative-prose` blocks inside `[data-mode-content="narrative"]`; and populate
the shared footer source index.

If the user asks for a single-mode output (Newspaper-only or Narrative-only),
keep the template's dual-mode structure but leave the unused mode's DOM empty
with a placeholder comment. The toggle switch still appears but flips to a
blank view — this is acceptable.

## Shared Components

### Source Index

Both modes share one footer source index (`<section class="source-index">`)
that lists every Feed Item materially supporting the page. The source index is
outside both `[data-mode-content]` sections. In Narrative mode, supplemental
items appear as a brief "Also of note" paragraph near the end; low-information
and out-of-scope items skip the prose entirely and appear only in the source
index.

### Masthead

The masthead is shared. The header toggle switch is part of the masthead and
does not change between modes.

## Delivery

Deliver as `briefing_page` type via `feedcontext artifact deliver --artifact-type briefing_page`.

```bash
feedcontext artifact deliver \
  --artifact-type briefing_page \
  --file /tmp/feedcontext/2026-05-12-daily-briefing/combined-briefing.html \
  --synthesis-file /tmp/feedcontext/2026-05-12-daily-briefing/combined-briefing.synthesis.json \
  --title "Your Briefing Title" \
  --confirm
```
