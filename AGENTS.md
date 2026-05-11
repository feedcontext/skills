## FeedContext Skill Repository Agent Guidance

This repository is the public FeedContext Skill Repository. It is installed by
cloning, and the installable skill artifact must remain available under
`skills/feedcontext`.

Read first:

- `README.md`
- `skills/feedcontext/SKILL.md`
- Relevant action docs in `skills/feedcontext/actions/`

## Boundaries

- The FeedContext Skill consumes `api` only through public `/v1` APIs and the
  Auth Entry.
- Do not reference parent-directory paths, product-repository private source,
  product-repository workspace packages, or product-repository git submodules.
- Service interaction goes through the published `feedcontext` CLI. The skill
  may keep narrow local helpers only for deterministic local workflow mechanics.
- Local helpers must not print OAuth tokens.

## Development Norms

- Keep detailed endpoint usage in `skills/feedcontext/actions/`, not only in
  `skills/feedcontext/SKILL.md`.
- Run the `version` action before other FeedContext Skill actions in an agent
  session.
- Every source code change must be followed by `pnpm run build` before handoff,
  staging, commit, or push.
- Keep Write action safety as host approval plus CLI `--confirm`; v1 has no
  server-side dry-run.
- When API shape changes, update the published CLI first, then update skill
  action docs to describe the supported CLI surface.
- OPML import is a supported CLI workflow. The CLI parses the local OPML file
  and creates Subscriptions through public `/v1` writes with `--confirm`.
- Keep the Husky `pre-push` hook installed. The hook runs `pnpm run build`;
  because `build` regenerates skill artifacts and checks their git diff, a push
  must fail when generated artifacts are not aligned with the source code being
  submitted.
- Treat Skill Behavior Evals as the development loop for testing agent workflow
  behavior, not helper implementation correctness. They should replay realistic
  prompts, capture Codex traces and artifacts, and check whether the agent
  followed the documented FeedContext Skill workflow. Keep them separate from
  the required pre-push lane until the eval cases are stable enough for CI.
- Put Skill Behavior Eval harnesses and prompt suites under `evals/` at this
  repository root. Do not place eval harness files under `skills/feedcontext/`,
  which must remain the installable skill artifact.
- Start Skill Behavior Eval coverage with Agent-Composed Artifact and Audio
  Brief workflows because those flows depend on ordered agent behavior:
  Structured Synthesis, Synthesis Review, Show Script, Script Review, then
  artifact-specific rendering or audio generation.
- Grade Skill Behavior Evals in two layers. Use deterministic trace and file
  checks as hard gates for observable behavior such as running `version`,
  validating synthesis or Show Script files, preserving expected artifacts, and
  following required command order. Use rubric-based grading only for quality
  judgments that deterministic checks cannot capture, such as story setup,
  spoken style, evidence fit, and whether an Audio Brief sounds like a show
  rather than read-aloud source material.
- Split Skill Behavior Evals into `offline` and `live` lanes. The `offline`
  lane is the default and should use fixtures or local inputs for stable
  workflow regression checks. The `live` lane may call the real FeedContext API,
  but it must be explicitly opted into, require a valid CLI Session or test
  account, and remain outside the default pre-push lane.
- Base `live` Skill Behavior Evals on a dedicated test account and stable
  fixture Subscription set. Do not use a maintainer's personal FeedContext
  account as the default live eval baseline; personal accounts are suitable for
  manual acceptance only.
- `live` Skill Behavior Evals may cover Write actions only in the dedicated
  test account. Use identifiable test data, clean up created Subscriptions when
  practical, preserve diagnostic output when cleanup fails, and keep the Write
  safety contract intact: host approval plus CLI `--confirm`. Do not bypass
  that contract for automation; evals should verify it.

## Verification

For FeedContext Skill changes, run:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm run build
```
