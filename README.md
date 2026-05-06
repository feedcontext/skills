# FeedContext Skill

Public source repository for the FeedContext Skill.

The FeedContext Skill lets agents authenticate through `api`, store a local
Skill Session, and call FeedContext v1 APIs for RSS/Atom Subscriptions and Feed
Items. The skill should not expose Source as a public resource.

This repository is installed by cloning. The installable skill artifact is
maintained directly under `skills/feedcontext`, while helper source, tests, and
development tooling live at the repository root.

Installable action docs:

- `skills/feedcontext/actions/api.md`
- `skills/feedcontext/actions/briefing-page.md`
- `skills/feedcontext/actions/opml.md`
- `skills/feedcontext/actions/troubleshooting.md`

Development commands:

```bash
pnpm install
pnpm test
pnpm validate:openapi
pnpm run pack
```

Use `OPENAPI_URL` to validate against a non-production OpenAPI document:

```bash
OPENAPI_URL=http://localhost:8787/openapi.json pnpm validate:openapi
```
