# Structured Synthesis

Use this shared stage before rendering any agent-composed artifact that
organizes, groups, synthesizes, explains, or editorially structures FeedContext
items. Structured Synthesis is the evidence-backed intermediate artifact for
briefing pages, audio scripts, and other local outputs.

Structured Synthesis is not required when the user only asks for full Feed Item
display, export, or listing as a Feed Item stream.

For v1, do not add a separate Artifact Topic field to the schema. Treat each
topic-level `units[]` entry as the Artifact Topic when the synthesis is for an
organized page or Audio Brief.

Do not generate a briefing, digest, summary, insight set, script, roundup, or
visual summary as final prose first. First create a Structured Synthesis JSON
sidecar that captures the units to render and the evidence that supports each
unit.

## Shared Flow

```text
Feed Items
   |
   v
Feed Item reads
   |
   v
Structured Synthesis <--------------------.
   |                                      |
   v                                      |
Synthesis Review gate --revise------------'
   |
   v
Reviewed Structured Synthesis
   |
   v
Artifact-specific rendering or scripting
```

`blocked` returns to the main agent for missing evidence, scope, content reads,
or user decisions. `revise` returns to Structured Synthesis editing. `ready`
allows the workflow to continue into the artifact-specific stage.

## Inputs

- The explicit user request, including topic, time range, language, audience,
  exclusions, and output mode.
- Candidate Feed Items from `item list` or `item list --all`.
- Feed Item details from `item get` or `item get-many` when the item materially
  supports the artifact.
- The Gather Sidecar or item discovery notes when a broad candidate set was
  processed.
- Contextual or external evidence only when supplied in the current context or
  explicitly requested by the user.

Use `item get-many` for bounded concurrent detail reads when several selected
Feed Items need content:

```bash
node scripts/helper.mjs item get-many --id item_1 --id item_2 --id item_3
```

## Creation

Use `schemas/structured-synthesis.schema.json` as the generated schema artifact
and `node scripts/helper.mjs synthesis schema` as the canonical helper-backed
schema source. Validate with:

```bash
node scripts/helper.mjs synthesis validate --file path/to/artifact.synthesis.json
```

Keep the JSON sidecar next to the generated artifact when practical:

```text
feedcontext-briefing-2026-05-06.html
feedcontext-briefing-2026-05-06.synthesis.json
```

Minimum shape:

```json
{
  "schema_version": "1",
  "scope": {
    "request": "today's briefing",
    "time_range": {
      "published_after": 1777996800000,
      "label": "Beijing time 2026-05-06"
    },
    "candidate_count": 95,
    "active_subscription_count": 10,
    "selection_rule": "Grouped today's visible Feed Items by theme, then selected high-information items with direct evidence for the main insights.",
    "used_contextual_evidence": false
  },
  "units": [
    {
      "id": "market-structure-shift",
      "type": "insight",
      "title": "Market structure is shifting",
      "claim": "Several related stories point to a change in how the market is organized.",
      "supporting_evidence": [
        {
          "kind": "feed_item",
          "feed_item_id": "item_123",
          "url": "https://example.com/story",
          "subscription_title": "Example Feed",
          "title": "Example story",
          "published_at": 1777996800000,
          "relevance": "direct",
          "reason": "Reports the concrete change that directly supports the claim."
        }
      ],
      "selection_rationale": "This is the lead because multiple Feed Items point to the same underlying shift.",
      "rendering_priority": "lead"
    }
  ],
  "secondary_items": [
    {
      "feed_item_id": "item_456",
      "url": "https://example.com/brief",
      "title": "Example secondary item",
      "subscription_title": "Example Feed",
      "published_at": 1777996800000,
      "group": "low_information_gain",
      "reason": "Relevant but mostly repeats the lead evidence."
    }
  ]
}
```

## Evidence Rules

- Default evidence is `kind: "feed_item"`.
- Use `kind: "contextual"` only for evidence already present in the current
  agent context or explicitly supplied by the user.
- Use `kind: "external_url"` only when the user asked to combine FeedContext
  with external material.
- If contextual or external evidence is used, disclose that lightly in the final
  artifact's scope note or sidecar notes.
- Important artifact claims should remain traceable in the Structured Synthesis
  sidecar even when the final artifact exposes sources lightly.
- Relevance labels are coarse: `direct`, `supporting`, or `background`. Do not
  invent numeric citation scores.
- Deterministic selections still need a lightweight `selection_rule`, such as
  "latest five visible Feed Items by publication time."
- Semantic selections need a real `selection_rationale`, especially when the
  agent includes, excludes, groups, or down-ranks Feed Items.

For broad briefings from many candidate Feed Items, account for items outside
the main units in `secondary_items` when useful. Groups are:

- `supplemental`: useful additional reading that did not shape the main unit;
- `low_information_gain`: repetitive, promotional, too narrow, or otherwise
  weak material;
- `out_of_scope`: visible in the candidate set but weakly related to the
  requested scope.

## Review

Run `synthesis-review.md` after validation and before artifact-specific
rendering, page writing, or script writing for organized or synthesized
artifacts. Continue only when the latest review verdict is `ready`.
