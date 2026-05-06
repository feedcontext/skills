---
name: feedcontext
description: Use FeedContext through the first-party helper to authenticate, read Feed Items, and manage RSS/Atom Subscriptions.
---

# FeedContext Skill

FeedContext is skill-first. Use this root skill to route to the action docs and
the generated helper script.

Before any other FeedContext action in an agent session, run:

```bash
node dist/feedcontext.mjs version
```

The version action prints JSON with installed and latest git revisions,
`upgrade_available`, and the `npx skills install feedcontext` upgrade command.
Use conversation context to decide whether to surface upgrade availability to
the user.

## Actions

- Read and write FeedContext data through `actions/api.md`.
- Convert OPML to repeated Subscription creates through `actions/opml.md`.
- Troubleshoot OAuth and local Skill Session storage through
  `actions/troubleshooting.md`.

This skill artifact is generated from `packages/skill` during CI publish. Do
not hand-edit generated dist.
