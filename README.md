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
- turn feed context into traceable briefings.

It is not a feed reader UI or a product console. It is a skill for agents that
work alongside FeedContext.

## Install

```bash
npx skills install feedcontext
```

After installation, use the skill instructions in `skills/feedcontext/SKILL.md`.

## Skill Docs

- `skills/feedcontext/actions/api.md`
- `skills/feedcontext/actions/auth.md`
- `skills/feedcontext/actions/briefing-page.md`
- `skills/feedcontext/actions/feed-items.md`
- `skills/feedcontext/actions/migration.md`
- `skills/feedcontext/actions/subscriptions.md`
- `skills/feedcontext/actions/troubleshooting.md`

## Core Concepts

- **Subscription**: a user's relationship to an RSS or Atom feed.
- **Feed Item**: one visible content entry from a subscription.
- **Briefing**: an agent-composed local artifact grounded in visible Feed Items.

Briefings should keep important insights traceable to their supporting Feed
Items without turning the reading experience into an audit interface.

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
