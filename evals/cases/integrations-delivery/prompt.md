Use the FeedContext Skill docs to plan Telegram integration readiness behavior for this offline scenario.

Scenario:
- The user has a ready server-rendered artifact and asks to send it to Telegram.
- This eval must not call the live FeedContext API.

Write `integrations-plan.json` in the eval output directory with:
- `workflow: "integrations-delivery"`
- `checks_telegram_status_first: true`
- `delivers_only_final_artifacts: true`
- `uploads_drafts: false`
- `requires_user_approval_for_delivery: true`
- `commands`: ordered example command strings for version and integration telegram status.
- `reports_delivery_command_unavailable: true`
- `uses_structured_synthesis_sidecar: false`

Also write `command-trace.json`.
