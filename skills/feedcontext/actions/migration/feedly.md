# Feedly Migration

Best path: direct OPML export from the Feedly web app.

Feedly exposes an OPML export page in the web app. Use this path before trying
API integration. Do not start with Feedly API or OAuth for v1 migration.

Before giving steps, determine whether the host agent can operate the user's
browser or local files.

## CLI-Guided

Use this path when the host agent cannot operate the user's browser or local
files.

Ask the user to open:

```text
https://feedly.com/i/opml
```

The user must be signed in to Feedly in the browser. Ask them to download the
OPML file and provide its local path.

## Browser-Assisted

Use this path when the host agent can operate the user's browser or local files.

After explicit user approval, open the Feedly OPML export page:

```text
https://feedly.com/i/opml
```

Let the user complete any login or consent step. If the browser asks where to
save the OPML file, use only the user-selected save path. If the file downloads
without an explicit path visible to the agent, ask the user for the downloaded
file path. Do not search local directories to find the downloaded file. Import
the user-specified OPML file into FeedContext after host approval.

## Notes

Feedly OPML exports RSS subscriptions. Do not promise migration of Boards, Read
Later, AI feeds, private integrations, or saved article state.
