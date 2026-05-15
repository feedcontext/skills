---
name: feedcontext
description: Provides first-party FeedContext workflows for authentication, Feed Item reading, RSS/Atom Subscription management, and traceable server-rendered artifacts. Use when the user asks to connect FeedContext, inspect feeds, read Feed Items, manage Subscriptions, or create feed-backed briefings or audio briefs.
---

# FeedContext Skill

FeedContext is skill-first. Use this root skill to route to the action docs and
the `feedcontext` CLI. Read only the action doc needed for the user's current
workflow; do not load every action doc by default.

## CLI Invocation

Run a version check before other FeedContext actions:

```bash
feedcontext version || npx -y feedcontext@latest version
```

Prefer the local `feedcontext` binary. If it is missing, apply the same
`npx -y feedcontext@latest` fallback to documented CLI commands. If both fail,
report that CLI execution is unavailable and ask the user to install
`feedcontext` with `npm install -g feedcontext`.

When the host prompt provides an explicit local helper path for validation, use
that exact path for local-only helper commands. The first helper command in a
local artifact workflow should still be `version`, for example:

```bash
node /path/to/skills/feedcontext/scripts/helper.mjs version
```

Run `feedcontext auth status` before auth-sensitive workflows. If there is no
local Skill Session, run `feedcontext auth anonymous` by default. Ask for formal
login only when the user wants durable storage, cross-device sync, account
switching, or an integration that requires a formal account.

Use `feedcontext auth login` for formal login. Use `feedcontext auth logout`
when the user asks to sign out, switch accounts, or clear a stale local session.

## Action Router

- `actions/auth.md`: CLI Session status, anonymous auth, formal login, pair
  code completion, logout, and account switching.
- `actions/feed-items.md`: Feed Item discovery, pagination, reading, and
  `get-many` for selected items.
- `actions/subscriptions.md`: Subscription list, approved add, and approved
  delete.
- `actions/integrations.md`: Telegram binding status and integration readiness.
- `actions/api.md`: public `/v1` boundary and raw calls when high-level CLI
  commands are not enough.
- `actions/artifact/README.md`: shared artifact workflow for briefings,
  pages, audio briefs, and full Feed Item streams.
- `actions/migration.md`: RSS reader migration and OPML import routing.
- `actions/troubleshooting.md`: recovery paths after auth, write, or API
  boundary failures.

When the user asks to import or migrate existing subscriptions, follow
`actions/migration.md` first. If the user did not name the source platform and
did not provide an OPML or export file, ask which RSS reader they are migrating
from before choosing a platform playbook. Use `actions/migration/opml.md` when
an OPML or export file is already available.

When reading Feed Items, remember that `item list` is paginated and returns one
page by default. Use `item list --all` when the user asks for all matching Feed
Items.

When composing summaries, roundups, insights, briefing pages, or audio briefs,
follow `actions/artifact/README.md`: create reviewed structured files, then
submit an Artifact Definition Bundle with `feedcontext artifact
submit-definition`. For audio briefs, create and validate a Show Script before
submission. For briefing pages and audio briefs, create and validate an
Artifact Sizing Review with `node scripts/helper.mjs sizing validate --file
<artifact-sizing.json>` before bundle submission. Do not generate local HTML,
podcast/audio files, or audio segment manifests.

Artifact DSL schemas are owned by `api` under
`https://api.feedcontext.io/schemas/`. Local helper validation fetches the
canonical schema on every run; the installed skill must not rely on bundled
offline schema JSON.

For organized page or audio artifacts, do not default the Artifact Topic count.
After candidate discovery, estimate the semantic topic count from the actual
Feed Items, recommend a count with evidence, and wait for user confirmation
unless the user already specified capacity or the request is a full Feed Item
stream/listing/export.

When the user asks to generate a page, briefing page, digest page, roundup page,
or HTML-like FeedContext artifact from live Feed Items, the default output is a
server-rendered Artifact submitted through `feedcontext artifact
submit-definition`. The skill must not render or return local HTML files for
Briefing Pages. If live FeedContext API access or `submit-definition` is
unavailable, report the blocker and preserve the reviewed definition bundle;
do not fall back to local HTML output.

When the user asks to send a generated page or audio brief to Telegram, follow
`actions/integrations.md` to confirm Telegram is linked. v1 does not expose a
CLI delivery command; do not invent one, and do not upload local final files or
sidecars from the skill.

This repository publishes the installable skill from `skills/feedcontext`.
Service interaction uses the published `feedcontext` CLI. Local helpers are for
deterministic local-only mechanics, such as schema validation and review
preflight. They must not render Briefing Page HTML or produce local final page
artifacts.
