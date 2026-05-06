# FeedContext API Actions

Use the generated helper:

```bash
node dist/feedcontext.mjs version
node dist/feedcontext.mjs login
node dist/feedcontext.mjs subscriptions:list
node dist/feedcontext.mjs items:list
node dist/feedcontext.mjs items:get --id item_123
```

Run `version` before other FeedContext actions in an agent session. The helper
starts OAuth login when requested, stores a local Skill Session, and prints JSON
API responses. It must never print OAuth tokens.

## Version

Run:

```bash
node dist/feedcontext.mjs version
```

The helper prints installed and latest git revisions, whether an upgrade is
available, and the `npx skills install feedcontext` upgrade command. The agent
decides whether to notify the user.

## Login

Run:

```bash
node dist/feedcontext.mjs login
```

The helper opens Google login through `api.feedcontext.io`, starts a callback
server on `127.0.0.1`, validates OAuth `state`, exchanges the PKCE code, and
stores the Skill Session in the system credential store when available. If the
credential store is unavailable, it falls back to a local file with restrictive
permissions and prints a warning.

## Reads

High-level read commands:

```bash
node dist/feedcontext.mjs subscriptions:list
node dist/feedcontext.mjs items:list
node dist/feedcontext.mjs items:list --subscription-id sub_123
node dist/feedcontext.mjs items:get --id item_123
```

Raw read calls are allowed only for these paths:

- `GET /v1/status`
- `GET /v1/subscriptions`
- `GET /v1/items`
- `GET /v1/items/{item_id}`

Example:

```bash
node dist/feedcontext.mjs raw --method GET --path /v1/items
```

## Writes

Before write actions, ask the host for approval. After approval, pass
`--confirm`; the helper refuses mutating calls before any network request when
`--confirm` is missing.

Allowed write paths:

- `POST /v1/subscriptions`
- `DELETE /v1/subscriptions/{subscription_id}`

Examples:

```bash
node dist/feedcontext.mjs subscriptions:add --feed-url https://example.com/feed.xml --confirm
node dist/feedcontext.mjs subscriptions:delete --id sub_123 --confirm
```

Raw write example after host approval:

```bash
node dist/feedcontext.mjs raw \
  --method POST \
  --path /v1/subscriptions \
  --body '{"feed_url":"https://example.com/feed.xml"}' \
  --confirm
```

## Public Resources

The public resources are:

- Subscription
- Feed Item

Do not expose internal source identifiers or internal storage models in user
responses.
