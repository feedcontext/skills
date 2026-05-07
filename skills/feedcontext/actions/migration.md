# Assisted RSS Platform Migration

Use this action when the user asks to import, migrate, move, or bring existing
RSS/Atom subscriptions into FeedContext. OPML import is a migration execution
path, so start here even when the user says "import OPML" unless an OPML file
is already available and no source-platform guidance is needed.

Start by identifying:

1. the source RSS reader or service;
2. whether the host agent can operate the user's browser or local files;
3. whether the user already has an OPML, XML, JSON, CSV, or backup export file.

If the user did not name a source platform, ask which RSS reader they are
migrating from before giving instructions. If the user did not say whether the
agent can operate the browser or local files, ask before choosing a
browser-assisted path.

## Platform Playbooks

Use the closest platform playbook:

- `migration/feedly.md`
- `migration/inoreader.md`
- `migration/opml.md`

If the user already has an OPML or export file, use
`migration/opml.md`. If no platform playbook matches, fall back to
`migration/opml.md` and tell the user the source platform is not yet covered by
a dedicated playbook. The v1 dedicated platform playbooks are Feedly and
Inoreader because they are the mainstream migration sources.

## Migration Modes

Prefer the strongest available mode:

1. OAuth-native or API-native migration, when the platform exposes a supported
   authorized subscription API and the user can authorize it.
2. Direct OPML export, when the platform has a stable export URL or documented
   export endpoint. If the host agent can operate the browser and the user has
   approved that access, open the export URL directly and capture the downloaded
   OPML file instead of asking the user to navigate the settings UI.
3. Browser-assisted export, when the agent has user approval to operate the
   browser or local files.
4. CLI-guided export, when the agent can only give the user exact instructions
   and continue after the user supplies a file.

Do not bypass access controls, CAPTCHA, rate limits, or login requirements.

## Import Into FeedContext

After an export file is available, use `migration/opml.md` when the file is
OPML or when another export file needs local conversion into OPML.

If a platform returns a subscription list through an API rather than OPML,
convert the authorized subscription URLs into an OPML file locally, then import
that OPML file through `migration/opml.md`.

## Scope

Assisted migration creates FeedContext Subscriptions. It does not migrate read
state, saved items, highlights, tags, private timelines, newsletters, account
settings, or source-platform folders unless a platform playbook explicitly says
the data is represented in the subscription export.
