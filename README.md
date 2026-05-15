# FeedContext Skill

This repository contains the **FeedContext Skill** for the `feedcontext.io`
platform. It is the agent-side companion for working with a user's feeds,
subscriptions, and feed-backed briefings.

## What It Does

FeedContext Skill helps agents:

- connect to FeedContext;
- read RSS/Atom feed items;
- manage subscriptions with approval;
- migrate or import subscriptions from existing RSS readers and OPML files;
- turn feed context into reviewed server-rendered artifact definitions,
  including briefing pages and audio briefs;
- check Telegram binding readiness.

It is not a feed reader UI or a product console. It is a skill for agents that
work alongside FeedContext.

## Install

```bash
npx skills add feedcontext/skills
```

After installation, use the skill instructions in `skills/feedcontext/SKILL.md`.

## Skill Docs

- `skills/feedcontext/actions/api.md`
- `skills/feedcontext/actions/auth.md`
- `skills/feedcontext/actions/artifact/README.md`
- `skills/feedcontext/actions/artifact/audio-brief.md`
- `skills/feedcontext/actions/artifact/briefing-page.md`
- `skills/feedcontext/actions/feed-items.md`
- `skills/feedcontext/actions/integrations.md`
- `skills/feedcontext/actions/migration.md`
- `skills/feedcontext/actions/subscriptions.md`
- `skills/feedcontext/actions/troubleshooting.md`

## Core Concepts

- **Subscription**: a user's relationship to an RSS or Atom feed.
- **Feed Item**: one visible content entry from a subscription.
- **Briefing**: an agent-composed Artifact Definition Bundle grounded in
  visible Feed Items and rendered by FeedContext.
- **Audio Brief**: an agent-composed audio artifact definition generated from a
  reviewed Show Script and rendered by FeedContext.
- **Telegram Integration**: account-level Telegram binding status. v1 does not
  expose a CLI artifact delivery command.

Briefings should keep important insights traceable to their supporting Feed
Items without turning the reading experience into an audit interface.

Canonical artifact DSL schemas are served by `api` at
`https://api.feedcontext.io/schemas/`. The skill helper fetches those schemas
on each validation run instead of shipping offline schema copies.

## FAQ

### What is FeedContext Skill?

FeedContext Skill is the companion agent skill for `feedcontext.io`. It helps
agents connect to FeedContext, read RSS/Atom Feed Items, manage subscriptions
with approval, and create traceable briefings.

### Is FeedContext Skill a feed reader?

No. FeedContext Skill is not a feed reader UI or product console. It is a skill
for agents that work alongside FeedContext.

## Development

Development commands are listed in `package.json`. Keep generated skill
artifacts up to date before release.
