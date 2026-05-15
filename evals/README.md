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

## Gate Adoption

Keep the first behavior-eval loop outside the default pre-push gate. Adopt it in
stages:

1. Start with a manual `pnpm eval:offline` development check.
2. Add a non-blocking CI job or manually triggered workflow after the first
   traces are useful.
3. Promote only stable deterministic offline trace checks into the default gate.
4. Keep rubric-based checks and `live` evals as release or manual acceptance
   checks, not default pre-push requirements.

Add `package.json` scripts only when the commands exist. Reserve
`pnpm eval:offline` for independent-agent offline runs and
`pnpm eval:contract` for the deterministic contract checker.
Use `pnpm eval:live` for read-only live API checks and
`pnpm eval:diagnostic` for the low-end model matrix.

## Live Eval Account

Live behavior evals use a dedicated eval account, never the maintainer's
personal FeedContext account. The live runner must isolate CLI session state
with an eval-only `FEEDCONTEXT_STATE_DIR`; session files, tokens, run outputs,
and provider caches must stay out of git.

Live evals assume the dedicated eval account has already been logged in locally
through the normal FeedContext CLI flow. Do not add a product login endpoint
only for evals, and do not inject OAuth tokens into Promptfoo vars, prompts, or
agent environment.

The live runner must require `FEEDCONTEXT_EVAL_STATE_DIR` and map it to
`FEEDCONTEXT_STATE_DIR` for both preflight CLI checks and the independent agent
process. Missing `FEEDCONTEXT_EVAL_STATE_DIR` is a hard preflight failure. Live
evals must not silently reuse the default local account state.

Adopt live evals read-only first. The first short-input live suite should cover
real API execution for:

- listing the eval account's Subscriptions;
- reading recent Feed Items from the eval account's stable fixture sources;
- producing a Briefing artifact from those Feed Items.
- continuing a multi-turn flow from recent news to Briefing to Audio Brief
  script without re-fetching or skipping the explicit intermediate artifacts.

Live write-action evals require a separate design: identifiable test data,
explicit host approval plus `--confirm`, cleanup, and diagnostics when cleanup
fails.

## Multi-Turn Evals

Multi-turn behavior evals must verify explicit artifact continuity, not hidden
model memory. Each turn should persist the state needed by later turns as a
named output file, and later turns must read that file instead of re-fetching or
continuing from implicit chat context.

A representative live multi-turn short-input case is:

1. User asks for recent news. The agent reads real Feed Items and writes
   `feed-items.snapshot.json` plus a turn summary.
2. User asks for a Briefing from the previous result. The agent reads
   `feed-items.snapshot.json`, then writes Structured Synthesis and Synthesis
   Review files.
3. User asks for an Audio Brief from that Briefing. The agent reads the
   reviewed synthesis, writes Show Script and Script Review files, and submits
   or preserves the reviewed bundle according to the case permissions.

The contract should fail if a later turn silently re-fetches data, skips the
prior artifact, or produces final prose/scripts without the staged review files.

## Model Matrix

Low-end and low-reasoning model runs are diagnostic first, not default blocking
gates. The default blocking path should stay on the primary model and the
stable offline suite. Diagnostic model lanes should emit the same run summaries
and failure packets, but a failure should be classified before it changes the
default gate.

Use the model matrix to answer whether the skill prompt constraints are strong
enough below the primary model:

- `default`: full offline suite plus selected read-only live cases.
- `low-reasoning`: short live read-only prompts plus the multi-turn artifact
  continuity case.
- `low-end`: short API routing prompts first; promote full Briefing or Audio
  Brief only after the shorter cases are stable.

Classify low-end failures as prompt constraint too weak, ambiguous skill docs,
model capability floor, or over-strict contract. Promote only consistently
stable diagnostic cases into the blocking gate.

Keep model selection in the Promptfoo execution matrix rather than in
`case.json`. A case manifest describes the behavior, permissions, fixtures, and
expected contract; model/profile selection is an execution dimension for the
same case. Promptfoo test vars may provide `codex_model`, `codex_profile`,
`matrix_label`, or an eval lane label, and the runner should translate those
vars into `codex exec --model ...` or `codex exec --profile ...`.

## Harness Shape

Use Promptfoo as the outer eval orchestration, reporting, and CI framework when
practical. Promptfoo should call a FeedContext-owned provider or runner that
starts the independent agent, injects the FeedContext Skill, provides local
fixtures, asks the agent to execute the prompt, and captures the resulting trace
and artifacts.

Promptfoo does not replace the FeedContext case manifest, permission model,
read-only skill boundary, expected output contract, or failure packet format.

The harness should be able to grant the independent agent real shell, network,
and `feedcontext` CLI access when an eval case explicitly declares those
permissions. Keep fixture-only `offline` cases available for stable local
regression checks; use `live` or explicitly network-enabled cases when the
agent should call the real FeedContext API.

Network-enabled FeedContext evals must use a dedicated eval or test account
with a stable fixture Subscription set. Do not default to a maintainer's
personal account for repeatable behavior evals.

Independent agent runs must treat the skill repository and installed skill
artifact as read-only. They may write only to the case's isolated output
directory for traces, failure packets, and generated artifacts. Repair modes
that let the evaluated agent edit skill source are not part of FeedContext Skill
behavior evals.

Use a file-level contract runner as the grading layer for those agent-produced
artifacts. It should read expected contracts and the captured trace, then check
command order, expected files, schema validation, review contracts, and
forbidden content rules. Maintainer-approved golden traces are reference
examples and regression fixtures, not a substitute for running the independent
agent.

Eval failures should create a failure packet for maintainer review rather than
auto-editing the skill. Include the case id, prompt, trace summary, produced
artifacts, failed contract checks, suggested edit surface, and failure
classification, such as model variance, unclear skill instruction, helper gap,
or fixture issue.

## Case Format

Use one directory per structured eval case:

```text
evals/cases/audio-brief-basic/
|-- case.json
|-- prompt.md
|-- fixtures/
|   `-- feed-items.json
`-- expected.contract.json
```

`case.json` should declare the execution boundary for the independent agent:

- `lane`: `offline` or `live`;
- `permissions`: shell, network, and `feedcontext` CLI access required by the
  case;
- `skill`: the FeedContext Skill path or install reference to inject;
- `prompt_file`: the prompt given to the independent agent;
- `fixture_files`: local fixtures available to the case;
- `expected_contract_file`: the contract used by the grading layer;
- `timeout_seconds`: the maximum run time;
- `account_policy`: `none` or `dedicated_eval_account_required`.

Use explicit permission allowlists and default every permission to off. A first
case manifest should model permissions as:

```json
{
  "permissions": {
    "shell": true,
    "network": false,
    "feedcontext_cli": false,
    "skill_repo_write": false,
    "output_write": true
  }
}
```

`skill_repo_write` must always be `false`. `output_write` must be `true` and
limited to the isolated case output directory. `feedcontext_cli` access must be
declared explicitly and must not be inferred from `shell`. When a case enables
network access for real FeedContext API work, it must require
`account_policy: "dedicated_eval_account_required"`.

CSV prompt indexes may remain as lightweight discovery lists, but per-case JSON
manifests are the source of truth for harness execution.

Validate `expected.contract.json` with
`evals/schemas/expected-contract.schema.json`. The expected contract should keep
deterministic hard gates separate from rubric grading. Hard gates cover required
files, schema validations, review verdicts, command order, HTML checks,
JSON-path checks, forbidden patterns, and artifact-boundary checks. Rubric
grading may be referenced separately for qualitative review, but it should not
change the meaning of hard gate pass/fail.

## Implementation Order

Build the harness in this order:

1. Define the `case.json` schema.
2. Implement the deterministic `expected.contract.json` checker.
3. Add the first `structured-synthesis-basic` eval case.
4. Add the independent agent runner that writes only to isolated case outputs.
5. Extend coverage to **Briefing Page** and **Audio Brief** cases.

## First Coverage

Start with Agent-Composed Artifact and Audio Brief workflows. These flows depend
on ordered agent behavior:

1. Run `version` before other FeedContext Skill actions.
2. Create and validate Structured Synthesis before final artifact prose,
   scripts, pages, or audio.
3. Run Synthesis Review before artifact-specific rendering or scripting.
4. Create and validate Show Script before server-rendered Audio Brief submission.
5. Run Script Review before script-only handoff or bundle submission.

The first local self-verification loop should be an `offline` lane with golden
traces and deterministic checks only. It should not require live FeedContext API
calls, server audio rendering, or repeated model sampling.

Cover three golden traces first:

1. `Structured Synthesis` only: produce a `.synthesis.json` file, validate it
   against the generated schema, and preserve a Synthesis Review contract.
2. `Briefing Page`: produce a reviewed Artifact Definition Bundle from a
   `.synthesis.json` file and check that the dual-mode page DSL structure,
   source index inputs, and expected files exist.
3. `Audio Brief`: create and validate a Show Script from a reviewed
   `.synthesis.json` file, preserve a Script Review contract, and produce the
   bundle submission inputs. Server rendering remains a live or manual
   acceptance concern.

Golden traces should record verifiable behavior, not hidden reasoning or exact
model wording. Keep:

- the input prompt and fixture Feed Items;
- the expected command order, including `version`, validation, and bundle
  preparation commands;
- key output file paths plus small file summaries;
- review contracts with `ready`, `revise`, or `blocked` verdicts and required
  edits;
- final output contracts, such as expected files, valid schemas, definition
  bundle structure, source index inputs, and forbidden content checks;
- one maintainer-approved reference trace that demonstrates the intended path.

Do not require exact natural-language matches, preserve hidden chain-of-thought,
or treat one good artifact's full prose as the only acceptable answer.

## Coverage Matrix

The first full offline behavior suite covers the installable skill's main
action surfaces:

- `structured-synthesis-basic`: shared **Structured Synthesis** base output.
- `audio-brief-script`: reviewed synthesis to **Show Script** and Script
  Review, stopping before server audio rendering or any local audio output.
- `auth-anonymous-routing`: version/status/anonymous-first auth routing and
  formal-login exceptions.
- `feed-items-workflow`: Feed Item discovery, `--all` pagination, and
  `get-many` reading for artifacts.
- `subscriptions-write-safety`: Subscription list/add/delete safety and
  `--confirm` write boundary.
- `integrations-delivery`: Telegram status check and unavailable delivery
  command boundary.
- `migration-opml-safety`: OPML import safety, explicit file path, and
  `--confirm` write boundary.
- `api-boundary`: documented `/v1` raw API boundary and no internal source/token
  exposure.
- `troubleshooting`: auth recovery, unsupported API path, and write-refusal
  guidance.

The read-only live behavior suite covers short realistic user inputs against a
real dedicated eval account:

- `live-short-subscriptions`: "获取我的订阅" through real Subscription listing.
- `live-short-recent-news`: "输出最近新闻" through real Feed Item discovery.
- `live-short-briefing`: "输出我的简报" through real Feed Item discovery and
  Structured Synthesis.
- `live-multiturn-brief-to-audio`: recent news -> Briefing -> Audio Brief
  script over explicit files across turns.

Real Telegram binding, write actions, and server audio rendering remain
separate opt-in `live` or manual acceptance coverage because they need external
services, explicit approval, and cleanup.

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
host approval plus CLI `--confirm`. Evals should verify that contract rather
than bypass it.
