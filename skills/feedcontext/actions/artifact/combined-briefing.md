# Combined Briefing Page

Use this action when the user asks for a digest, briefing, recap, roundup, or
summary from FeedContext. This is the primary briefing page action; see
`briefing-page.md` and `narrative-briefing.md` for mode-specific prose guidance.

The agent output is an Artifact Definition Bundle with separate reviewed
**Newspaper Briefing** and **Narrative Briefing** DSL files derived from the
same reviewed Structured Synthesis. `api` renders the single-file **Briefing
Page** and exposes the public viewer URL after the render job is ready.

For live FeedContext items, this server-rendered path is mandatory. Do not
answer a page request with only `helper.mjs artifact render-page` output unless
the user explicitly asked for a local-only HTML file, the prompt is
fixture/offline, or `submit-definition` is blocked and the blocker is reported.

## Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. Use `item list` or `item list --all` to discover candidate Feed Items. If a
   local Feed Item fixture/export is provided, use it directly as the candidate
   set and do not call the live API.
3. If the user asks for an organized, grouped, synthesized page but does not
   specify capacity, do not choose a fixed default. First perform a lightweight
   topic estimate from the discovered candidates using titles, summaries,
   sources, timestamps, and duplicate or related-story clusters. Ask the user to
   confirm the recommended Artifact Topic count before synthesis. The prompt
   should include the candidate count, the estimated topic count, a short basis
   for the estimate, and alternatives such as a shorter priority edition,
   expanded edition, or full Feed Item stream when appropriate.
4. Use `item get` for one item or `item get-many` for several selected Feed
   Items that materially support the page.
5. Follow `structured-synthesis.md` to create, validate, and review a
   Structured Synthesis sidecar JSON file before deriving page DSL files.
6. Curate the page around the user's request. If the user does not give a
   precise scope, choose a coherent recent theme from visible Feed Items, but
   record the selection rule in the Structured Synthesis.
7. Write `briefing.newspaper.json` and `briefing.narrative.json` as separate
   page Artifact Format DSL files. Both must reference the same reviewed
   Structured Synthesis and must not introduce new Feed Item evidence.
8. Write `briefing.newspaper-review.json` and `briefing.narrative-review.json`.
   Do not submit the bundle unless both reviews and the Synthesis Review are
   `ready`.
9. Pack the reviewed synthesis, reviews, page DSL files, and render metadata
   into `briefing.bundle.json`, then submit it:

   ```bash
   feedcontext artifact submit-definition \
     --artifact-type briefing_page \
     --bundle-file /tmp/feedcontext/2026-05-12-daily-briefing/briefing.bundle.json \
     --title "Daily Briefing" \
     --confirm
   ```
10. Report the returned artifact id and render status, then open the returned
    public viewer URL for the user.

## Offline Fixture Path

When a prompt supplies fixture Feed Items and requires direct output files,
write the Structured Synthesis, Synthesis Review, page DSL files, format
reviews, Artifact Definition Bundle, and command trace directly in the requested
output directory. Do not call the live API unless the prompt explicitly asks for
server rendering.

This section is only for fixture/offline prompts or explicit local-file output.
It is not the normal path for live user updates.

```bash
node /path/to/skills/feedcontext/scripts/helper.mjs version
node /path/to/skills/feedcontext/scripts/helper.mjs synthesis validate --file briefing.synthesis.json
```

Do not run auth, `item list`, or live API commands for fixture-only prompts.

## Dual-Mode Output

The Briefing Page definition contains two page DSLs that api renders into one
file:

- **Newspaper Briefing**: See `briefing-page.md` for editorial shape and prose
  guidance. Renders Artifact Topics as independent modules in a multi-column
  editorial grid with a masthead, figures, pull quotes, compact source marks,
  and topic-scoped `body_units`. The HTML marks this reader-facing format as
  `magazine`.

- **Narrative Briefing**: See `narrative-briefing.md` for editorial shape and
  prose guidance. Dissolves Artifact Topics into one continuous polished
  magazine-feature prose with inline rich-text source citations and drop-cap
  section breaks between topic shifts. The HTML marks this reader-facing format
  as `longform`.

Both modes share the same Structured Synthesis and Traceable Evidence set. The
server renderer owns the masthead, footer source index, toggle behavior, and
HTML/CSS.

## Mode Selection

When the user's preference is clear from keywords, pick the dominant mode:

- **Newspaper keywords**: grid, layout, visual, columns, newspaper, magazine
- **Narrative keywords**: narrative, long-form, story, prose, flowing, article

When the user just says "briefing" without any distinguishing keywords, ask
which mode they prefer. If the user says they don't care, produce the combined
dual-mode page (both modes in one file).

## Prose Approach Per Mode

The complete page contains two prose versions per Artifact Topic. Generate or
provide structured text fields rather than hand-writing the entire page shell.
The Newspaper DSL uses modules with `layout_role`, `display_format`,
`rendering_priority`, optional lead image fields, and `body_units`; the
Narrative DSL uses flowing text units. The toggle switch shows one mode and
hides the other.

### Newspaper Module

For each Artifact Topic, write a module object:

- `headline`: reader-facing topic headline.
- `layout_role`: `lead`, `major`, `standard`, or `brief`.
- `display_format`: `story`, `analysis`, `bulletin`, or `quote`.
- `rendering_priority`: numeric order within equivalent roles.
- `evidence_refs`: module-level Feed Item evidence ids.
- `body_units`: topic-scoped long-form paragraphs with roles
  `lead_paragraph`, `detail_paragraph`, or `context_paragraph`.
- `image_url` and `image_alt` when a safe relevant lead visual is available.

Use `body_units[].evidence_refs` for paragraph-level source marks. If a module
has no `body_units`, its short `text` fallback is rendered as-is; web SSR will
not expand it. Follow `briefing-page.md` for editorial voice.

Example module shape:

```json
{
  "headline": "Liquidity signals dominate the market tape",
  "layout_role": "lead",
  "display_format": "analysis",
  "rendering_priority": 100,
  "evidence_refs": ["feed_item_1", "feed_item_2"],
  "image_url": "https://example.com/lead-image.jpg",
  "image_alt": "Trading desks watching liquidity data",
  "body_units": [
    {
      "role": "lead_paragraph",
      "text": "Central-bank liquidity, social financing, lending, and reverse-repurchase updates clustered into one market signal.",
      "evidence_refs": ["feed_item_1"]
    },
    {
      "role": "detail_paragraph",
      "text": "The related feed items point to a repricing of liquidity preference rather than an isolated macro print.",
      "evidence_refs": ["feed_item_1", "feed_item_2"]
    },
    {
      "role": "context_paragraph",
      "text": "That makes the topic suitable for lead treatment because it connects market data, policy cadence, and risk appetite.",
      "evidence_refs": ["feed_item_2"]
    }
  ]
}
```

### Narrative Prose

For each Artifact Topic, write substantive prose that flows into the next
topic. `rendering_priority` drives sequence: lead topics open the narrative
with deeper coverage, main topics fill the middle, secondary and collapsed
topics get briefer treatment toward the end. Between topic shifts, open the new
section with a drop-cap paragraph and a prose bridge (e.g., "Meanwhile, in the
AI space..."). Inline source citations are woven naturally into the text as
rich-text annotations. Follow `narrative-briefing.md` for editorial voice.

## Renderer Contract

Do not write final HTML. The Artifact Definition Bundle must provide structured
Newspaper and Narrative DSL fields for the server renderer: masthead metadata,
topic ordering, module roles, display formats, `body_units`, source references,
citation points, optional image fields, and source-index inputs. The server
renderer owns HTML, CSS, toggle behavior, popovers, icon display, and
source-index markup.

Local HTML generated by the helper is an optional preview or offline artifact.
It must not replace the server-rendered Briefing Page for live FeedContext
requests.

If the user asks for a single-mode output, do not label it **Briefing Page**.
The combined Briefing Page requires both reviewed page DSL files.

## Shared Components

### Source Index

Both modes share one footer source index (`<section class="source-index">`)
that lists every Feed Item materially supporting the page. The source index is
outside both `[data-mode-content]` sections. In Narrative mode, supplemental
items appear as a brief "Also of note" paragraph near the end; low-information
and out-of-scope items skip the prose entirely and appear only in the source
index.

For "all updates" page requests, treat "all" as full candidate coverage and
traceability, not as permission to silently choose a smaller topic count. Ask
the user to confirm the recommended topic synthesis count, then preserve the
complete Feed Item stream/source index in the page bundle.

### Masthead

The masthead is shared. The header toggle switch is part of the masthead and
does not change between modes.

## Delivery

Submit as `briefing_page` type via `feedcontext artifact submit-definition`.

```bash
feedcontext artifact submit-definition \
  --artifact-type briefing_page \
  --bundle-file /tmp/feedcontext/2026-05-12-daily-briefing/briefing.bundle.json \
  --title "Your Briefing Title" \
  --confirm
```

After the returned artifact status is `ready`, delivery is a separate explicit
confirmation:

```bash
feedcontext artifact deliver-rendered \
  --id art_example \
  --caption "Your Briefing Title" \
  --confirm
```
