# Mechanical Delegation

Use this note only when the host environment supports sub-agents or parallel
workers. Default to a single main agent unless the work is clearly mechanical,
expensive, and has stable inputs.

If the executing agent does not support sub-agent or parallel worker
orchestration, do not simulate it, invent a handoff, or split the workflow by
documentation alone. Keep the work in the main agent and proceed serially.

## Keep In Main Agent

Do not delegate these stages:

- Feed Item discovery and scope decisions.
- Feed Item content reading for major evidence.
- Source selection, ranking, grouping, and exclusions.
- Structured Synthesis creation.
- Show Script narrative design, Story Setup, host roles, pacing, and tone.
- Provider choice when the user has not already selected one.

These stages carry user intent, evidence judgment, privacy decisions, and
narrative continuity.

## Delegable Work

Delegation is acceptable after the main agent has produced the required input
artifact, such as a validated `.script.json` or prepared `.segments.json`.

Delegable tasks include:

- Convert a completed Show Script JSON file into TTS segments.
- Render independent TTS segments through the selected provider.
- Retry failed segments from an existing segment manifest.
- Assemble a final audio file from completed segment files.
- Generate a readable Markdown script or spoken text file from an existing Show
  Script when the main agent has already made narrative decisions.
- Check generated file presence, ordering, segment duration, and final output
  existence.

## Coordination Rules

- Give each worker a concrete input file and output path.
- Workers must not rewrite Structured Synthesis, alter Show Script text, change
  provider choice, or reinterpret Feed Items.
- The main agent owns final inspection and user-facing reporting.
- If the context is small or the provider render is already serial, do not
  split the work just to use sub-agents.
