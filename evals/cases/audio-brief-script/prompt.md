Use the FeedContext Skill to create the script-only Audio Brief path from the fixture Feed Items.

Scope:
- Produce Structured Synthesis first.
- Produce a Synthesis Review contract.
- Produce a machine-readable Show Script JSON.
- Produce a Script Review contract.
- Stop before server rendering, local segment manifests, local provider
  rendering, local assembly, or local audio metadata review.
- Do not call the live FeedContext API.
- Do not call any audio provider.

Required output files in the eval output directory:

1. `briefing.synthesis.json`
   - Valid FeedContext Structured Synthesis JSON.
   - Use exactly two Artifact Topic units.
   - The `scope.request` must include `audio brief script`.

2. `synthesis-review.json`
   - JSON review contract with `verdict: "ready"` and `ready_for_artifact: true`.

3. `show-script.json`
   - Valid FeedContext Show Script JSON.
   - Use `intent: "script_then_audio"`.
   - Use `format: "two_host"`.
   - Include at least two hosts.
   - Spoken text must not include source URLs.

4. `script-review.json`
   - JSON review contract with `verdict: "ready"`.
   - Include empty `required_edits`.

5. `command-trace.json`
   - First command is helper `version`.
   - Include `synthesis validate` and `show-script validate`.
   - Do not include local `audio` helper commands.

Use the installed skill docs and helper only. Write all outputs directly in the eval output directory.
