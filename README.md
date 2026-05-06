# FeedContext Skill

Public source repository for the FeedContext Skill.

The FeedContext Skill lets agents authenticate through `api`, store a local
Skill Session, and call FeedContext v1 APIs for RSS/Atom Subscriptions and Feed
Items. The skill should not expose Source as a public resource.

This repository is installed by cloning, so the checkout contains both source
files and the packed helper at `dist/feedcontext.mjs`.

Action docs:

- `actions/api.md`
- `actions/briefing-page.md`
- `actions/opml.md`
- `actions/troubleshooting.md`

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
