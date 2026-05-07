# OPML Migration

Use this playbook when the user already has an OPML or other subscription export
file, or when the source platform does not have a dedicated playbook.

## OPML

There is no OPML API endpoint. The helper parses OPML locally and creates one
Subscription per RSS or Atom URL with bounded local concurrency.

Procedure:

1. Parse `<outline>` elements.
2. Keep only unique `xmlUrl` values that are valid `http` or `https` RSS/Atom URLs.
3. Ask the host for approval before creating subscriptions.
4. Run:

```bash
node scripts/helper.mjs subscription import-opml --file "$OPML_FILE" --confirm
```

The default local concurrency is `32`. Override it only when the host asks for a
smaller or larger fan-out:

```bash
node scripts/helper.mjs subscription import-opml --file "$OPML_FILE" --concurrency 8 --confirm
```

If a feed already exists, the API is idempotent and returns the existing active
Subscription. If a previously deleted Subscription is recreated, the API reuses
the existing Subscription id.

## Other Export Files

If the file is XML, JSON, CSV, or a backup archive, inspect it locally and look
for RSS or Atom feed URLs. Convert valid `http` and `https` feed URLs into OPML,
then import the OPML using the OPML procedure above.

Preserve a small local conversion report with:

- total URLs found;
- duplicate URLs skipped;
- invalid URLs skipped;
- source file name;
- generated OPML file path.

## Notes

Do not upload local export files to third-party services for conversion. Keep
conversion local unless the user explicitly asks otherwise.
