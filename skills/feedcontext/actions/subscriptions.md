# Subscriptions

Use this action when an agent needs to list, add, or delete RSS/Atom
Subscriptions.

## List

Run:

```bash
feedcontext subscription list
```

`subscription list` returns all RSS/Atom Subscriptions currently exposed by the
API. It is not paginated.

## Add

Before adding a Subscription, ask the host for approval. After approval, pass
`--confirm`; the CLI refuses mutating calls before any network request when
`--confirm` is missing.

```bash
feedcontext subscription add --feed-url https://example.com/feed.xml --confirm
```

## Delete

Before deleting a Subscription, ask the host for approval. After approval, pass
`--confirm`.

```bash
feedcontext subscription delete --id sub_123 --confirm
```

Deleting a Subscription removes the user's active relationship to a Source. Do
not describe it as deleting a Source.
