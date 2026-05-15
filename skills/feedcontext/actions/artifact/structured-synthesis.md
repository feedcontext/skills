# Structured Synthesis

Use this shared stage before any artifact that organizes, groups, synthesizes,
explains, or editorially structures FeedContext items. Skip it only when the
user asks for a full Feed Item display, export, or listing as a raw stream.

Structured Synthesis is the evidence-backed intermediate artifact for briefing
pages, audio scripts, and other server-rendered artifact definitions. Do not
write final prose, page DSL, or Show Script first.

For v1, each topic-level `units[]` entry is the Artifact Topic. Do not add a
separate Artifact Topic schema field.

## Flow

Feed Items -> optional broad coverage notes -> Feed Item reads -> Structured
Synthesis -> Synthesis Review -> artifact-specific DSL or script.

`blocked` returns to missing evidence, scope, content reads, or user decisions.
`revise` returns to synthesis editing. `ready` allows the next stage.

## Inputs

- explicit user request, time range, language, audience, exclusions, and output
  mode;
- candidate Feed Items from `item list` or `item list --all`;
- Feed Item details from `item get` or `item get-many` when materially
  supporting a claim;
- broad coverage notes when many candidates were processed;
- contextual or external evidence only when supplied in context or explicitly
  requested.

For broad aggregation, preserve enough local coverage state to prove all
in-scope summaries were reviewed before semantic selection: total candidates,
selected units, supplemental items, low-information-gain items, out-of-scope
items, and the selection rule. This replaces a separate Gather Sidecar doc.

## Creation

Use the canonical schema at
`https://api.feedcontext.io/schemas/structured-synthesis.v1.schema.json`.
Validate with `node scripts/helper.mjs synthesis validate --file
<synthesis.json>`; the helper fetches the canonical schema on every validation
and does not use a local offline schema copy.

Keep the synthesis JSON next to the related review, DSL, and bundle files in
the temp workspace. Minimum contract:

- `schema_version`;
- `scope` with request/time/candidate metadata and `selection_rule`;
- evidence-backed `units[]` with claim, rationale, priority, and supporting
  evidence;
- optional `secondary_items[]` for visible items outside the main units.

Use the canonical schema for exact field names.

## Evidence Rules

- Default evidence is `kind: "feed_item"`.
- Use `kind: "contextual"` only for evidence already present in the current
  agent context or explicitly supplied by the user.
- Use `kind: "external_url"` only when the user asked to combine FeedContext
  with external material.
- Mark contextual or external evidence so the final artifact can disclose it
  lightly.
- Important claims should remain traceable even when final sources are light.
- Relevance labels are coarse: `direct`, `supporting`, or `background`; do not
  invent numeric citation scores.
- Semantic selections need `selection_rationale`, especially when including,
  excluding, grouping, or down-ranking Feed Items.
- For broad briefings, account for items outside the main units with
  `supplemental`, `low_information_gain`, or `out_of_scope` groups when useful.

## Review

Run `synthesis-review.md` after validation and before page DSL or Show Script
work. Continue only when the latest review verdict is `ready`.
