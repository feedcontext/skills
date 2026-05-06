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

Use `node dist/feedcontext.mjs logout` when the user asks to sign out, switch
accounts, or clear a stale local session.

## Actions

- Read and write FeedContext data through `actions/api.md`.
- Convert OPML to concurrent Subscription creates through `actions/opml.md`.
- Troubleshoot OAuth and local Skill Session storage through
  `actions/troubleshooting.md`.

When reading Feed Items, remember that `items:list` is paginated and returns one
page by default. Use `items:list-all` when the user asks for all matching Feed
Items.

This skill artifact is generated from `packages/skill` during CI publish. Do
not hand-edit generated dist.
