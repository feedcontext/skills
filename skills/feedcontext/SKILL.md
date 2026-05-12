---
name: feedcontext
description: Provides first-party FeedContext workflows for authentication, Feed Item reading, RSS/Atom Subscription management, and traceable local artifacts. Use when the user asks to connect FeedContext, inspect feeds, read Feed Items, manage Subscriptions, or create feed-backed briefings or audio briefs.
---

# FeedContext Skill

FeedContext is skill-first. Use this root skill to route to the action docs and
the `feedcontext` CLI.

## CLI Invocation

Prefer the local `feedcontext` binary when it exists on `PATH`. If it is not
available, use `npx -y feedcontext@latest` as a best-effort fallback for the
same command:

```bash
feedcontext version || npx -y feedcontext@latest version
```

Apply the same fallback to other FeedContext CLI commands documented by this
skill. For example, `feedcontext item list` becomes
`npx -y feedcontext@latest item list` when the local binary is unavailable.
This fallback is a convenience path, not a guaranteed runtime contract: it
depends on npm registry access, a working Node/npm/npx installation, and sandbox
permission to write npm cache and temporary files. If both the local CLI and the
`npx` fallback fail, report that FeedContext CLI execution is unavailable in the
current environment and ask the user to install the CLI with
`npm install -g feedcontext`.

Before any other FeedContext action in an agent session, run:

```bash
feedcontext version
```

The version action prints JSON with CLI package metadata. Use it as the first
tool check before authenticated FeedContext CLI actions.

Then run `feedcontext auth status` before auth-sensitive workflows. If there is
no local Skill Session, do not ask the user to log in by default; run
`feedcontext auth anonymous` to create an anonymous Skill Session for local
Skill + CLI use. Ask the user to run formal login only when they want durable
storage, cross-device sync, account switching, or an integration that requires a
formal account.

Use `feedcontext auth login` for formal login. Use `feedcontext auth logout`
when the user asks to sign out, switch accounts, or clear a stale local session.

## Actions

- Authenticate and manage the local CLI Session through `actions/auth.md`.
- Read Feed Items through `actions/feed-items.md`.
- Manage Subscriptions through `actions/subscriptions.md`.
- Manage delivery integrations through `actions/integrations.md`.
- Use raw API calls and public resource boundaries through `actions/api.md`.
- Compose local artifacts through `actions/artifact/README.md`.
- Gather Feed Item aggregation sidecars through `actions/artifact/gather.md`.
- Compose editorial HTML briefing pages through `actions/artifact/combined-briefing.md`.
  - Newspaper Briefing prose reference: `actions/artifact/briefing-page.md`.
  - Narrative Briefing prose reference: `actions/artifact/narrative-briefing.md`.
- Compose Audio Brief scripts and generated audio through `actions/artifact/audio-brief.md`.
- Audio provider rendering remains a host/provider workflow. Follow
  `actions/artifact/audio-brief.md` and its rendering docs before using any
  host-provided audio tool or external provider.
- Migrate from existing RSS readers through `actions/migration.md`.
- Troubleshoot OAuth and local CLI Session storage through
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
audio. Put generated local files in that action's per-session system temporary
directory workspace, not directly in the current directory. For audio briefs,
create and validate a Show Script before generating audio.

When the user asks to send a generated page or audio brief to Telegram, follow
`actions/integrations.md` to confirm Telegram is linked, then follow
`actions/artifact/README.md` to upload and deliver the final artifact with its
Structured Synthesis sidecar.

This repository publishes the installable skill from `skills/feedcontext`.
Service-interaction docs should use the published `feedcontext` CLI. Local
helper docs must stay limited to deterministic local-only artifact mechanics
such as schema validation.
