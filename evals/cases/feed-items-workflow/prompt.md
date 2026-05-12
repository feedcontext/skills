Use the FeedContext Skill docs to plan Feed Item discovery and reading behavior for this offline scenario.

Scenario:
- The user asks for all matching Feed Items for a day and wants a synthesized artifact later.
- The agent must not call the live FeedContext API in this eval.

Write `feed-items-plan.json` in the eval output directory with:
- `workflow: "feed-items-workflow"`
- `uses_item_list_all_for_all_matching: true`
- `list_returns_content: false`
- `uses_get_many_after_selection: true`
- `search_content_requires_explicit_request: true`
- `commands`: ordered example command strings for version, item list --all, and item get-many.

Also write `command-trace.json`. It may record only local helper `version` in this offline case.
