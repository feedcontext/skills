# FeedContext API Actions

Use the generated helper:

```bash
node dist/feedcontext.mjs version
node dist/feedcontext.mjs login
node dist/feedcontext.mjs logout
node dist/feedcontext.mjs subscriptions:list
node dist/feedcontext.mjs subscriptions:list-all
node dist/feedcontext.mjs items:list
node dist/feedcontext.mjs items:list-all
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

The helper opens Google login through `api.feedcontext.io`, then exits after
printing `pair_code_required`. Ask the user to copy the 6-digit pair code from
the browser, then run:

```bash
node dist/feedcontext.mjs login --pair-code '<pair-code>'
```

The helper validates OAuth `state`, exchanges the PKCE code, and stores the Skill
Session in the system credential store when available. If the credential store is
unavailable, it falls back to a local file with restrictive permissions and
prints a warning.

## Logout

Run:

```bash
node dist/feedcontext.mjs logout
```

The helper removes the local Skill Session from the system credential store when
available, removes the fallback session file, and clears any pending login. It
does not call the FeedContext API, so it works even when the current token is
expired or invalid.

## Reads

High-level read commands:

```bash
node dist/feedcontext.mjs subscriptions:list
node dist/feedcontext.mjs subscriptions:list-all
node dist/feedcontext.mjs items:list
node dist/feedcontext.mjs items:list --subscription-id sub_123
node dist/feedcontext.mjs items:list --limit 100 --cursor '<next_cursor>'
node dist/feedcontext.mjs items:list-all
node dist/feedcontext.mjs items:get --id item_123
node dist/feedcontext.mjs items:get --id item_123 --cursor '<next_content_cursor>'
```

`subscriptions:list` returns all active RSS/Atom Subscriptions currently exposed
by the API. It is not paginated. `subscriptions:list-all` is an explicit alias
for agents responding to "list all subscriptions."

`items:list` is a discovery command. It is paginated and returns only one page
of Feed Item metadata:

- Default page size is `20`.
- Maximum page size is `100`.
- It does not return Feed Item content.
- If the JSON response has a non-null `next_cursor`, more Feed Items exist. Use
  that cursor with `items:list --cursor '<next_cursor>'`.
- Use `items:list-all` when the user asks for all matching Feed Items. It follows
  `next_cursor` automatically and uses `--limit 100` per page by default.
- Use `--search-content` only when the user explicitly wants to search Feed Item
  content, not just discovery metadata. It broadens search but still does not
  return Feed Item content in list responses.

`items:get` is the reading command. It returns `content_text` as Limited
Markdown in chunks of up to `12,000` characters by default. If
`next_content_cursor` is non-null, pass it back with `--cursor` to continue
reading the same Feed Item. Use `--include-html` only for recovery or debugging;
it returns `content_html` alongside `content_text`.

Supported `items:list` and `items:list-all` filters:

```bash
node dist/feedcontext.mjs items:list --limit 100
node dist/feedcontext.mjs items:list --cursor '<next_cursor>'
node dist/feedcontext.mjs items:list --subscription-id sub_123
node dist/feedcontext.mjs items:list --keyword 'agent'
node dist/feedcontext.mjs items:list --keyword 'agent' --search-content
node dist/feedcontext.mjs items:list --published-after 1700000000000
node dist/feedcontext.mjs items:list --published-before 1800000000000
node dist/feedcontext.mjs items:list --id item_1 --id item_2
node dist/feedcontext.mjs items:list-all --subscription-id sub_123
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
