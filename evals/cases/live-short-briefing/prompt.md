User request: 输出我的简报

Use the real FeedContext API through the FeedContext CLI and the provided live eval account session.

Required behavior:
- Run FeedContext CLI `version` first.
- Run `feedcontext auth status`.
- Run `feedcontext item list --all` to discover real Feed Items.
- Select a compact set of real Feed Items, then run `feedcontext item get-many` or `feedcontext item get` for selected evidence.
- Write `feed-items.snapshot.json`.
- Write and validate `briefing.synthesis.json` as FeedContext Structured Synthesis.
- Write `synthesis-review.json` with `verdict: "ready"` and `ready_for_artifact: true`.
- Do not render final prose before the Structured Synthesis and review exist.
- Do not run login, anonymous auth, logout, subscription writes, raw token inspection, or any mutation.

`feed-items.snapshot.json` must include:
- `schema_version: "1"`
- `workflow: "briefing_from_recent_items"`
- `request: "输出我的简报"`
- `source: "feedcontext_api"`
- `items`: the real candidate Feed Items.
- `auth_checked: true`

`briefing.synthesis.json` scope request must include `输出我的简报`.
