# Newspaper Briefing — Prose Reference

This is a prose-style reference for the **Newspaper Briefing** rendering mode
within a combined Briefing Page. For the primary workflow (discovery,
Structured Synthesis, review, mode selection, delivery), see
`combined-briefing.md`.

The Newspaper Briefing renders Artifact Topics as independent modules in a
multi-column editorial grid. The starting template is at
`templates/combined-briefing.html`.

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

Each Artifact Topic becomes a `.newspaper-module` inside
`[data-mode-content="newspaper"] > .grid`. Use `.lead` for the top story,
`.wide` for cross-feed patterns, `<aside>` with `.pullquote` for rhythm breaks.

## Module Prose

Each Newspaper module is compact: a headline (h2 for lead, h3 for others), one
or two dense paragraphs of synthesis, and a `.source-mark` listing the
supporting Feed Items by feed name and item title. Write as an editor: cut
fluff, keep density, and make every sentence earn its space.

## Sources

Use compact source marks inside modules, such as the feed name, publication
date, and a short linked Feed Item title. Every Feed Item shown as evidence or
as a listed item should link to its original URL when the Feed Item provides
one. Add a complete source index at the bottom with every Feed Item that
materially supports the page.

Each major insight should cite supporting evidence from the Structured
Synthesis. If an insight is the agent's synthesis across several items, say so
through the framing and include the supporting items in the source index.

Expose explainability lightly:

- evidence links may include hover text from the evidence `reason`;
- use coarse labels such as `direct`, `supporting`, or `background`;
- use sentence-level marks for strong claims, numbers, risk conclusions, or
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

When using a remote image URL, download the image into a local temporary
directory before referencing it from the page. This avoids broken rendering from
cross-origin restrictions, hotlink protection, expiring URLs, or blocked remote
requests. Store downloaded and generated images inside the artifact session
workspace, such as `/tmp/feedcontext/2026-05-12-daily-briefing/assets/`.
Reference those local files from the HTML with paths that work when the page is
opened locally. If the user requires a single physical file with no sidecar
assets, embed the local image data as a data URI instead of linking to the
remote URL.
