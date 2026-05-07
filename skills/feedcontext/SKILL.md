---
name: feedcontext
description: Provides first-party FeedContext helper workflows for authentication, Feed Item reading, RSS/Atom Subscription management, OPML import, and traceable local artifacts. Use when the user asks to connect FeedContext, inspect feeds, read Feed Items, manage Subscriptions, import OPML, or create feed-backed briefings or audio briefs.
---

# FeedContext Skill

FeedContext is skill-first. Use this root skill to route to the action docs and
the packed helper script.

Before any other FeedContext action in an agent session, run:

```bash
node scripts/helper.mjs version
```

The version action prints JSON with installed and latest git revisions,
`upgrade_available`, and the `npx skills install feedcontext` upgrade command.
Use conversation context to decide whether to surface upgrade availability to
the user.

Use `node scripts/helper.mjs logout` when the user asks to sign out, switch
accounts, or clear a stale local session.

## Actions

- Authenticate and manage the local Skill Session through `actions/auth.md`.
- Read Feed Items through `actions/feed-items.md`.
- Manage Subscriptions through `actions/subscriptions.md`.
- Use raw API calls and public resource boundaries through `actions/api.md`.
- Compose local artifacts through `actions/artifact/README.md`.
- Gather Feed Item aggregation sidecars through `actions/artifact/gather.md`.
- Compose editorial HTML briefing pages through `actions/artifact/briefing-page.md`.
- Compose Audio Brief scripts and generated audio through `actions/artifact/audio-brief.md`.
- Migrate from existing RSS readers through `actions/migration.md`.
- Troubleshoot OAuth and local Skill Session storage through
  `actions/troubleshooting.md`.

When the user asks to import or migrate existing subscriptions, follow
`actions/migration.md` first. If the user did not name the source platform and
did not provide an OPML or export file, ask which RSS reader they are migrating
from before choosing a platform playbook. Use `actions/migration/opml.md` when
an OPML or export file is already available.

When reading Feed Items, remember that `item list` is paginated and returns one
page by default. Use `item list --all` when the user asks for all matching Feed
Items.

When composing summaries, roundups, insights, briefings, briefing pages, or
audio briefs, follow `actions/artifact/README.md`: create and validate a
Structured Synthesis JSON sidecar before rendering prose, HTML, scripts, or
audio. For audio briefs, create and validate a Show Script before generating
audio.

This repository publishes the installable skill from `skills/feedcontext`.
Helper source changes must refresh `scripts/helper.mjs` before release so this
directory remains runnable.
