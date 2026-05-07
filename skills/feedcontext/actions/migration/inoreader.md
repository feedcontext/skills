# Inoreader Migration

Best path: OPML export from the Inoreader web app.

Inoreader exposes OAuth and subscription APIs, but v1 migration does not use
them because API access may require a Pro account or commercial arrangement.
Use OPML export first.

Before giving steps, determine whether the host agent can operate the user's
browser or local files.

## CLI-Guided

Use this path when the host agent cannot operate the user's browser or local
files.

Ask the user to open Inoreader in a desktop browser, go to Preferences, then
Import, Export, Backup, and export subscriptions as OPML. Ask for the downloaded
file path.

## Browser-Assisted

Use this path when the host agent can operate the user's browser or local files.

After explicit user approval, open Inoreader, let the user complete login, go to
Preferences -> Import, Export, Backup, download the OPML export, then import it
into FeedContext after host approval.

## Notes

Do not promise migration of rules, monitoring feeds, saved pages, read state,
tags, or account settings unless the user explicitly exports those separately
and asks for local conversion.
