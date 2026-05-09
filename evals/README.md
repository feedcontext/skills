# Skill Behavior Evals

Skill Behavior Evals test whether Codex follows the documented FeedContext
Skill workflows in realistic agent runs. They complement the helper's unit,
type, lint, and build checks; they do not replace them.

## Lanes

- `offline`: default lane for stable workflow regression checks using fixtures
  or local inputs.
- `live`: opt-in lane that may call the real FeedContext API with a dedicated
  test account and stable fixture Subscription set. Keep this lane outside the
  default pre-push path.

Do not use a maintainer's personal FeedContext account as the default live eval
baseline. Personal accounts are suitable for manual acceptance only.

## First Coverage

Start with Agent-Composed Artifact and Audio Brief workflows. These flows depend
on ordered agent behavior:

1. Run `version` before other FeedContext Skill actions.
2. Create and validate Structured Synthesis before final artifact prose,
   scripts, pages, or audio.
3. Run Synthesis Review before artifact-specific rendering or scripting.
4. Create and validate Show Script before audio generation.
5. Run Script Review before script-only handoff or audio rendering.

## Grading

Use deterministic trace and file checks as hard gates for observable behavior:

- command order;
- expected helper validations;
- expected artifact files;
- absence of parent-repo private paths or install-artifact pollution.

Use rubric-based grading only for qualitative checks that deterministic tests
cannot capture, such as story setup, spoken style, evidence fit, and whether an
Audio Brief sounds like a show rather than read-aloud source material.

## Write Actions

Live Write action evals are allowed only in the dedicated test account. Use
identifiable test data, clean up created Subscriptions when practical, preserve
diagnostic output when cleanup fails, and keep the Write safety contract intact:
host approval plus helper `--confirm`. Evals should verify that contract rather
than bypass it.
