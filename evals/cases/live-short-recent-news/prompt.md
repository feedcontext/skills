User request: 输出最近新闻

Use the real FeedContext API through the FeedContext CLI and the provided live eval account session.

Required behavior:
- Run FeedContext CLI `version` first.
- Run `feedcontext auth status`.
- Run `feedcontext item list --all` with a bounded recent scope. If the CLI supports a limit, keep the result compact.
- Write `feed-items.snapshot.json` in the eval output directory.
- Do not invent news. The snapshot must come from the CLI response.
- Do not run login, anonymous auth, logout, subscription writes, raw token inspection, or any mutation.

`feed-items.snapshot.json` must be JSON with:
- `schema_version: "1"`
- `workflow: "recent_news"`
- `request: "输出最近新闻"`
- `source: "feedcontext_api"`
- `items`: an array of real Feed Item discovery records copied or normalized from the CLI response.
- `item_count`: the array length.
- `auth_checked: true`
