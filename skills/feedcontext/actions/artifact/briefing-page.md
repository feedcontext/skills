# Briefing Page

Use this action when the user asks for a digest, briefing page, roundup,
newspaper page, narrative briefing, or HTML-like FeedContext artifact.

The agent creates a Briefing Page Artifact Definition Bundle from reviewed
Structured Synthesis. `api` renders the final single-file page and returns the
public viewer URL. Do not write or return local HTML for live FeedContext page
requests.

## Workflow

1. Follow `README.md` for discovery, capacity, content reads, Structured
   Synthesis, and Synthesis Review.
2. Produce page DSL files only after Synthesis Review is `ready`.
3. For the default combined page, write two DSL views from the same synthesis:
   Newspaper Briefing and Narrative Briefing.
4. Write short page format reviews. Do not submit unless Synthesis Review and
   both page reviews are `ready`.
5. Create and validate an Artifact Sizing Review with one `newspaper` unit per
   rendered Artifact Topic. The review must use the synthesis unit's `type` and
   `rendering_priority`, include the unit prose text, and pass `sizing
   validate`.
6. Pack the reviewed synthesis, reviews, page DSL files, sizing review, source
   index, and
   render metadata into a bundle.
7. Submit with `feedcontext artifact submit-definition --artifact-type
   briefing_page --bundle-file <bundle.json> --title <title> --confirm`.
8. Report the artifact id and render status, then open the returned public
   viewer URL.

For fixture-only eval prompts, write the requested structured files in the
provided output directory and skip live API calls unless the prompt explicitly
asks for server rendering.

## Mode Selection

- Newspaper mode: use when the user asks for grid, layout, visual, columns,
  newspaper, magazine, or a dense editorial page.
- Narrative mode: use when the user asks for narrative, long-form, story,
  prose, flowing, or article.
- If the user just asks for a briefing page, produce the combined page with
  both modes unless they choose one mode.

## Newspaper DSL

Newspaper mode renders Artifact Topics as independent editorial modules in a
multi-column page. The DSL should provide deterministic renderer intent:

Canonical schema:
`https://api.feedcontext.io/schemas/newspaper-briefing.v1.schema.json`.

- one `lead` module, with additional important topics marked `major`;
- `layout_role`: `lead`, `major`, `standard`, or `brief`;
- `display_format`: `story`, `analysis`, `bulletin`, or `quote`;
- `rendering_priority` for ordering within equivalent roles;
- topic-scoped `body_units` such as lead, detail, and context paragraphs;
- `rich_text` Evidence Links for strong claims, numbers, risk conclusions, and
  trend judgments;
- source refs and optional safe image fields.

Write the module prose like a compact newspaper item, not a card summary. The
server renderer owns HTML, CSS, masthead, toggles, layout, and source-index UI.
It must not infer inline citation anchor text from `evidence_refs`; the DSL
must provide natural linked phrases.

The Artifact Sizing Review should measure the prose assigned to each synthesis
unit after page DSL generation. If a `lead` unit validates as too short, deepen
the factual setup and evidence-backed consequence. If a `collapsed` unit
validates as too long, demote its prose into source-index or roundup treatment.

## Narrative DSL

Narrative mode dissolves Artifact Topics into one polished magazine-style prose
piece. Use reviewed synthesis order and `rendering_priority` for sequence:
lead topics open with the deepest coverage, main topics carry the middle, and
secondary topics appear later or in a brief "also of note" section.

Canonical schema:
`https://api.feedcontext.io/schemas/narrative-briefing.v1.schema.json`.

Write for silent reading, not spoken delivery. Avoid host turns, pacing marks,
direct audience address, transcript rhythm, and section headers. Use natural
prose bridges between topic shifts and inline `rich_text` Evidence Links where
they read cleanly. The footer source index still preserves all materially
supporting Feed Items.

## Coverage

For broad or "all updates" requests, do not silently collapse the artifact to a
small highlight list. Ask for confirmation on the estimated Artifact Topic
count, then preserve the complete Feed Item stream/source index in the bundle.
Lower-priority items may be compact or source-index-only, but they should remain
traceable.

Images are optional editorial assets. Prefer relevant safe remote or generated
images only when they improve the page; otherwise rely on typography and
hierarchy. The DSL should describe image intent and alt text, not local final
HTML image wiring.
