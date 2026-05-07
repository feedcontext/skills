# Inoreader Migration

Best path: direct OPML export from Inoreader's subscription export URL.

Inoreader exposes OAuth and subscription APIs, but v1 migration does not use
them because API access may require a Pro account or commercial arrangement.
Use the browser-session OPML export first.

Before giving steps, determine whether the host agent can operate the user's
browser or local files.

## CLI-Guided

Use this path when the host agent cannot operate the user's browser or local
files.

Ask the user to open:

```text
https://www.inoreader.com/reader/subscriptions/export
```

The user must be signed in to Inoreader in the browser. The URL returns the
subscription OPML export directly for a signed-in browser session. If the
browser displays the OPML document instead of downloading it, tell the user they
can copy the complete page contents and give the copied OPML text to the agent.
If it downloads a file, ask for the downloaded file path.

## Browser-Assisted

Use this path when the host agent can operate the user's browser or local files.

After explicit user approval, open the Inoreader subscription export URL:

```text
https://www.inoreader.com/reader/subscriptions/export
```

If the browser is already signed in to Inoreader, opening the URL should
directly download or display the OPML export. If the browser asks for login, let
the user complete login and then reopen the same URL. If the OPML is displayed
in the browser, copy the complete OPML document from the page or ask the user to
provide it, save it to a local `.opml` file, then import it into FeedContext
after host approval.

## Notes

Do not promise migration of rules, monitoring feeds, saved pages, read state,
tags, or account settings unless the user explicitly exports those separately
and asks for local conversion.
