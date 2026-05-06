## FeedContext Skill Repository Agent Guidance

This repository is the public FeedContext Skill Repository. It is installed by
cloning and must remain checkout-runnable.

Read first:

- `README.md`
- `SKILL.md`
- Relevant action docs in `actions/`

## Boundaries

- The FeedContext Skill consumes `api` only through public `/v1` APIs, the Auth
  Entry, and published OpenAPI or contract artifacts.
- Do not reference parent-directory paths, product-repository private source,
  product-repository workspace packages, or product-repository git submodules.
- Keep the packed helper at `dist/feedcontext.mjs` committed because installs
  clone this repository.
- The helper must not print OAuth tokens.

## Development Norms

- Keep detailed endpoint usage in action docs, not only in the root `SKILL.md`.
- Run the `version` action before other FeedContext Skill actions in an agent
  session.
- Keep Write action safety as host approval plus helper `--confirm`; v1 has no
  server-side dry-run.
- When API shape changes, update the handwritten raw-action allowlist and
  action docs as needed.
- OPML import remains helper-local fan-out to individual Subscription creates;
  there is no OPML API endpoint in v1.

## Verification

For FeedContext Skill changes, run:

```bash
pnpm test
pnpm validate:openapi
pnpm run pack
```
