Use the FeedContext Skill to create the shared base output structure from the provided Feed Items fixture.

Scope:
- Produce only the Structured Synthesis stage.
- Do not render a Briefing Page.
- Do not create a Show Script.
- Do not call the live FeedContext API.

Required output files in the eval output directory:

1. `briefing.synthesis.json`
   - Valid FeedContext Structured Synthesis JSON.
   - Use exactly two `units`.
   - Every unit must include Feed Item evidence from the fixture.
   - Include at least one `secondary_items` entry.
   - The `scope.request` must include `local self-verification`.

2. `synthesis-review.json`
   - JSON review contract with `verdict: "ready"`.
   - Include `ready_for_artifact: true`.
   - Include empty `required_edits`.

3. `command-trace.json`
   - JSON object with `schema_version: "1"`.
   - Record each shell command you ran in order.
   - The first command must be the helper `version` action.
   - Include the Structured Synthesis validation command after writing `briefing.synthesis.json`.

Use Artifact Topics as semantic groups, not Feed Item counts. Keep the output concise and evidence-backed.
