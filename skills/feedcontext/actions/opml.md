# OPML Import

There is no OPML API endpoint. Agents should parse OPML locally and create one
Subscription per RSS or Atom URL.

Procedure:

1. Parse `<outline>` elements.
2. Keep only `xmlUrl` values that are valid `http` or `https` RSS/Atom URLs.
3. Ask the host for approval before creating subscriptions.
4. For each URL, run:

```bash
node dist/feedcontext.mjs subscriptions:add --feed-url "$FEED_URL" --confirm
```

If a feed already exists, the API is idempotent and returns the existing active
Subscription. If a previously deleted Subscription is recreated, the API reuses
the existing Subscription id.
