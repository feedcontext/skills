# FeedContext API Actions

Use this action doc as the API boundary map. Prefer the focused action docs for
normal workflows:

- Authenticate and manage the local CLI Session through `auth.md`.
- Read Feed Items through `feed-items.md`.
- Manage Subscriptions through `subscriptions.md`.
- Manage Telegram delivery through `integrations.md`.
- Compose traceable local artifacts through `artifact/README.md`.
- Migrate or import existing subscriptions through `migration.md`.
- Use OPML migration through `migration/opml.md` after an OPML or export file is available.
- Recover from failures through `troubleshooting.md`.

Run `version` before other FeedContext actions in an agent session:

```bash
feedcontext version
```

The CLI starts OAuth login when requested, stores a local CLI Session, and
prints JSON API responses. It must never print OAuth tokens.

## Raw API Calls

Prefer high-level CLI commands before using `raw`. Raw calls are allowed only
for the documented public `/v1` Subscription and Feed Item paths.

Raw read calls are allowed only for these paths:

- `GET /v1/status`
- `GET /v1/subscriptions`
- `GET /v1/items`
- `GET /v1/items/{item_id}`
- `GET /v1/integrations/telegram`

Example:

```bash
feedcontext raw --method GET --path /v1/items
```

Raw write calls require host approval and `--confirm`. The CLI refuses
mutating calls before any network request when `--confirm` is missing.

Allowed raw write paths:

- `POST /v1/subscriptions`
- `DELETE /v1/subscriptions/{subscription_id}`
- `POST /v1/integrations/telegram/binding-link`
- `DELETE /v1/integrations/telegram`
- `PUT /v1/uploads`
- `POST /v1/artifacts`

Example after host approval:

```bash
feedcontext raw \
  --method POST \
  --path /v1/subscriptions \
  --body '{"feed_url":"https://example.com/feed.xml"}' \
  --confirm
```

## Public Resources

The public resources are:

- Subscription
- Feed Item
- Telegram Integration
- Artifact Delivery Submission

Do not expose internal source identifiers or internal storage models in user
responses.
