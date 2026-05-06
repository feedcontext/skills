# OPML Import

There is no OPML API endpoint. The helper parses OPML locally and creates one
Subscription per RSS or Atom URL with bounded local concurrency.

Procedure:

1. Parse `<outline>` elements.
2. Keep only unique `xmlUrl` values that are valid `http` or `https` RSS/Atom URLs.
3. Ask the host for approval before creating subscriptions.
4. Run:

```bash
node scripts/helper.mjs subscriptions:import-opml --file "$OPML_FILE" --confirm
```

The default local concurrency is `32`. Override it only when the host asks for a
smaller or larger fan-out:

```bash
node scripts/helper.mjs subscriptions:import-opml --file "$OPML_FILE" --concurrency 8 --confirm
```

If a feed already exists, the API is idempotent and returns the existing active
Subscription. If a previously deleted Subscription is recreated, the API reuses
the existing Subscription id.
