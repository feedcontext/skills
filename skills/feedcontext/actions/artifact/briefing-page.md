# Newspaper Briefing — Prose Reference

This is a prose-style reference for the **Newspaper Briefing** rendering mode
within a combined Briefing Page. For the primary workflow (discovery,
Structured Synthesis, review, mode selection, delivery), see
`combined-briefing.md`.

The Newspaper Briefing renders Artifact Topics as independent modules in a
multi-column editorial grid. The agent writes structured DSL fields; the server
renderer owns the final HTML and CSS.

## Editorial Shape

A traditional newspaper reading experience:

- a masthead at the top with the page title, date, theme, and scope;
- a hero or lead module for the most important story or synthesized insight;
- editorial sections or columns that group multiple Artifact Topics into a
  small number of content areas, rather than a flat list of topics;
- mixed module sizes arranged by importance, not a uniform card list;
- dense but readable columns, rules, captions, sidebars, and pull quotes;
- old-money editorial styling: restrained palette, serif typography, generous
  margins, precise borders, and no app-dashboard chrome;
- a footer area with a complete source index.
- lightweight evidence affordances that do not make the page feel like an audit
  report.

The layout should feel like a complex editorial waterfall: large, medium, and
small modules interlock according to importance. Avoid generic SaaS cards,
marketing hero sections, and plain Markdown exported as HTML.

When a page has many Artifact Topics, derive a few section headings from the
content, such as product and platform changes, market and company moves, policy
and risk, or supplemental reading. These headings are a page-rendering decision,
not a separate Structured Synthesis schema field. Preserve the complete source
index even when the reading path is grouped into sections.

If the user selects a large page capacity such as 50 or 100 Artifact Topics, do
not silently collapse the artifact to a small highlight list. Give every
selected Artifact Topic a place in the page, using hierarchy to manage reading
pressure: lead modules for the most important topics, major sections for
clusters, compact modules for smaller topics, and supplemental sections for
lower-priority topics.

Each Artifact Topic should declare module-level renderer intent so the server
renderer can place it deterministically without making fresh editorial
judgments:

- `layout_role`: `lead`, `major`, `standard`, or `brief`.
- `display_format`: `story`, `analysis`, `bulletin`, or `quote`.
- `rendering_priority`: a number used to order modules within equivalent
  roles.

Use exactly one `lead` module. If more than one topic feels lead-worthy, choose
the strongest one from the reviewed Structured Synthesis and mark the rest as
`major`.

## Module Prose

Each Newspaper module is a topic-scoped article block, not just a card. Write a
headline plus `body_units` generated from the module's supporting evidence:

- `lead_paragraph`: the topic lead, usually one paragraph.
- `detail_paragraph`: factual expansion from the topic's supporting Feed Items.
- `context_paragraph`: background, implication, or explanatory context.

The `body_units` should make the topic read like a real newspaper item. Avoid a
single short summary sentence when the topic has multiple related Feed Items.
For legacy preview or fallback paths, a short `text` field may remain, but the
server renderer must not expand it during SSR. The long-form prose belongs in
`body_units`.

Each `body_units[]` entry may include `rich_text` spans with `evidence_ref` on
short natural-language phrases. Use those Evidence Links for strong claims,
numbers, risk conclusions, or trend judgments. Keep `evidence_refs` for
provenance and validation; renderers must not infer inline links from
`evidence_refs`.

Write as an editor: cut fluff, keep density, and make every sentence earn its
space.

## Sources

Do not use compact source marks inside modules. The server renderer presents one
footer source index grouped by Subscription/source. The DSL should provide
source references and rich-text Evidence Links; it should not hard-code UI
grouping, popover markup, or visual icon implementation.

Every Feed Item shown as evidence or as a listed item should link to its
original URL when the Feed Item provides one. Add a complete source index at the
bottom with every Feed Item that materially supports the page.

Each major insight should cite supporting evidence from the Structured
Synthesis. If an insight is the agent's synthesis across several items, say so
through the framing and include the supporting items in the source index.

Expose explainability lightly:

- Evidence Links should use natural phrases in the prose, not pasted article
  titles;
- use coarse labels such as `direct`, `supporting`, or `background`;
- use inline rich-text spans for strong claims, numbers, risk conclusions, or
  trend judgments;
- avoid visible numeric relevance scores;
- do not turn the page into an AI audit interface.

When the user asks for a broad briefing and candidate Feed Items are filtered
out of the main presentation, include a collapsed or secondary section for
supplemental, low-information-gain, or out-of-scope Feed Items. This section
should preserve user access to original URLs without competing with the main
editorial reading flow.

## Images

Images are editorial visuals for the page, not automatic per-item media copies.
The agent may use relevant available images, compose imagery from the source
material, or generate images when the environment supports it. If no image
clearly improves the page, rely on typography, borders, hierarchy, and captions
instead of forcing an unrelated visual.

Lead modules should prefer a relevant image when one is available and safe to
reference. When using images, include `image_url`, `image_alt`, image intent,
and source references in the DSL rather than linking local files from final
HTML. The server renderer decides whether a safe remote image, generated asset,
or typography-only treatment is available. If no image is provided for the lead,
the renderer may use a deterministic typography/source treatment as fallback.
