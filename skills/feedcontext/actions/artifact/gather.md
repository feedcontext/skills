# Gather Sidecar

Use this action when an agent needs to perform Agent-Composed Feed Aggregation,
such as ranking, grouping, summarizing, or synthesizing multiple Feed Items.

The Gather Sidecar is a local execution-trace artifact. It is separate from
Structured Synthesis: the Gather Sidecar records coverage and processing state,
while Structured Synthesis records evidence-backed units for artifact rendering.

## Workflow

Run:

```bash
node scripts/helper.mjs insight gather \
  --published-after 1700000000000 \
  --published-before 1700086400000 \
  --out today.gather.json
```

The helper follows Feed Item list pagination and writes every in-scope Feed Item
to the sidecar with `summary_reviewed: true`. Do not impose a semantic candidate
limit before reviewing all in-scope Summaries. Page sizes, batches, and
concurrency are execution details, not selection rules.

After the Gather Sidecar exists, use it to decide which Feed Items need full
reading through `item get` for one item or `item get-many` for several selected
items, then produce and validate Structured Synthesis before rendering HTML,
scripts, screenshots, or audio.

## Current Coverage

The current helper command covers the first aggregation step:

- list all in-scope Feed Items through public `/v1/items` pagination;
- preserve each Feed Item's discovery metadata and Summary;
- mark each item as `summary_reviewed: true`;
- write a local JSON sidecar with coverage counts.

Future helper work should add missing-Summary content reads, selected evidence
content reads, deduplication, and processing-state fields without collapsing the
Gather Sidecar into Structured Synthesis.
