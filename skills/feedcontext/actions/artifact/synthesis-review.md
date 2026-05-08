# Synthesis Review

Use this shared review gate after Structured Synthesis validation and before
artifact-specific rendering, page writing, or script writing. This gate checks
the factual and evidentiary spine of the artifact.

Synthesis Review may be performed by a separate reviewer agent when the host
environment supports multi-agent orchestration. If no reviewer agent is
available, the current agent must perform the same review itself.

## Inputs

- The Structured Synthesis sidecar.
- The Gather Sidecar or item discovery notes when available.
- The Feed Item content reads used as key evidence.
- Any explicit user request, scope, language, audience, or output preference.
- The Artifact Topic capacity decision when the synthesis was created from
  candidate Feed Items for an organized page or Audio Brief.

The reviewer should not rediscover Feed Items, expand scope, or invent new
evidence. If required evidence or content reads are missing, return `blocked`
to the main agent.

## Verdicts

Every review must produce exactly one verdict:

- `ready`: the synthesis may be used by the next artifact-specific stage.
- `revise`: the synthesis can be fixed from the existing inputs, but must be
  edited before another review.
- `blocked`: required evidence, content reads, scope, or user decisions are
  missing. Return control to the main agent.

Do not continue into artifact-specific rendering, page writing, or script
writing unless the latest Synthesis Review verdict is `ready`.

## Review Checklist

Check the synthesis for:

- Evidence support: every major unit has supporting evidence, and the claim is
  actually supported by that evidence.
- Story material: major news, risk, or trend units include enough factual
  material for later artifact rendering, not only an abstract conclusion.
- Content reads: major units that require factual explanation are based on key
  Feed Item content reads, not only titles or Summaries.
- Selection rationale: each unit explains why it was selected, grouped, or
  prioritized.
- Artifact Topic capacity: when the synthesis was created from candidate Feed
  Items for an organized page or Audio Brief, confirm the user specified the
  Artifact Topic count, or confirm a valid exception such as an existing
  Structured Synthesis sidecar or a full Feed Item stream request.
- Evidence relevance: relevance labels are coarse and non-numeric.
- Secondary coverage: low-signal, supplemental, or excluded items are handled
  explicitly when the request began from a broad candidate set.
- Evidence boundaries: contextual or external evidence is marked as such and
  lightly disclosed when used.
- Claim discipline: remove unsupported speculation, overbroad trend claims,
  and conclusions that do not follow from the evidence.
- Artifact readiness: the synthesis gives the next stage enough facts, context,
  and evidence ids to create the requested artifact in a normal human style.

## Hard Gates

The verdict must not be `ready` when any of these are true:

- A major synthesis unit has no supporting evidence.
- A claim is broader than the evidence supports.
- A major news, risk, or trend unit lacks enough factual material for the next
  artifact stage.
- A major factual unit relies only on title or Summary when content reading is
  needed.
- The synthesis silently drops relevant items from a broad candidate set without
  rationale or secondary handling.
- An organized page or Audio Brief synthesis was created from candidate Feed
  Items without a user-specified Artifact Topic count or a valid exception.
- Contextual or external evidence is used without being identified.
- Numeric confidence, relevance, or citation scores appear in the synthesis.

## Output

Preserve the reviewed Structured Synthesis sidecar. Include a short review note
next to it or in the artifact directory with:

- `verdict`: `ready`, `revise`, or `blocked`;
- `required_edits`: required changes before the next review, or an empty list;
- `story_material_gaps`: units missing factual setup material;
- `unsupported_or_overbroad_claims`: claims to remove, narrow, or support;
- `missing_content_reads`: Feed Items that need focused content reads;
- `artifact_topic_capacity_notes`: the requested Artifact Topic count or the
  exception that made a capacity prompt unnecessary;
- `secondary_coverage_notes`: broad-scope items that need secondary handling;
- `ready_for_artifact`: boolean, true only when `verdict` is `ready`.
