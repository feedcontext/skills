# OPML Migration

Use this playbook when the user already has an OPML or other subscription export
file, has pasted OPML document text, or when the source platform does not have a
dedicated playbook.

## OPML

CLI v1 imports OPML by parsing the local OPML file and creating Subscriptions
through public `/v1` writes. It is a host-approved write workflow, not an api
bulk import resource.

Procedure:

1. If the user provided pasted OPML text instead of a file path, save the exact
   text to a local `.opml` file.
2. If the user provided a file path, read only that path. Do not search local
   directories for OPML or export files.
3. Ask the host for approval before creating subscriptions.
4. If the current session is anonymous and the import would exceed 100 active
   Subscriptions, ask whether to import a smaller approved subset or run formal
   login first.
5. Import through the CLI:

```bash
feedcontext subscription import-opml --file path/to/subscriptions.opml --confirm
```

The CLI keeps only unique `xmlUrl` values that are valid `http` or `https`
URLs, ignores non-feed URLs, and creates subscriptions with bounded
concurrency. Use `--concurrency <count>` only when the user or host environment
needs a lower or higher write concurrency.

If a feed already exists, the API is idempotent and returns the existing active
Subscription. If a previously deleted Subscription is recreated, the API reuses
the existing Subscription id.

## Other Export Files

If the user-specified file is XML, JSON, CSV, or a backup archive, inspect that
file locally and look for RSS or Atom feed URLs. Convert valid `http` and
`https` feed URLs into an OPML file or a local report before import.

Preserve a small local conversion report with:

- total URLs found;
- duplicate URLs skipped;
- invalid URLs skipped;
- source file name;
- generated feed URL list path.

## Notes

Do not upload local export files to third-party services for conversion. Keep
conversion local unless the user explicitly asks otherwise.
