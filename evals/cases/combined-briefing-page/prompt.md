Use the FeedContext Skill to create a local combined Briefing Page from the fixture Feed Items.

Scope:
- Produce Structured Synthesis first.
- Produce a Synthesis Review contract.
- Render a complete local dual-mode HTML page.
- Do not create a Show Script.
- Do not call the live FeedContext API.

Required output files in the eval output directory:

1. `briefing.synthesis.json`
   - Valid FeedContext Structured Synthesis JSON.
   - Use exactly two Artifact Topic units.
   - Include evidence from the fixture.
   - The `scope.request` must include `combined briefing page`.

2. `synthesis-review.json`
   - JSON review contract with `verdict: "ready"`.
   - Include `ready_for_artifact: true`.
   - Include empty `required_edits`.

3. `briefing.html`
   - Render with the local helper `artifact render-page`.
   - Must contain both Newspaper and Narrative mode containers.
   - Must contain a Source Index.

4. `command-trace.json`
   - First command is helper `version`.
   - Include `synthesis validate`.
   - Include `artifact render-page`.

Use the installed skill docs and helper only. Write all outputs directly in the eval output directory.
