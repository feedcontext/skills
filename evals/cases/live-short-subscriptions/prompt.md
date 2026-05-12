User request: 获取我的订阅

Use the real FeedContext API through the FeedContext CLI and the provided live eval account session.

Required behavior:
- Run FeedContext CLI `version` first.
- Run `feedcontext auth status` before reading account data.
- Run `feedcontext subscription list`.
- Write `subscriptions.snapshot.json` in the eval output directory.
- Do not run login, anonymous auth, logout, subscription writes, raw token inspection, or any mutation.

`subscriptions.snapshot.json` must be JSON with:
- `schema_version: "1"`
- `workflow: "subscriptions_list"`
- `request: "获取我的订阅"`
- `source: "feedcontext_api"`
- `subscriptions`: an array copied or normalized from the real CLI response.
- `subscription_count`: the array length.
- `auth_checked: true`
