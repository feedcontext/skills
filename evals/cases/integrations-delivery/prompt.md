Use the FeedContext Skill docs to plan Telegram integration and artifact delivery behavior for this offline scenario.

Scenario:
- The user has a completed local final artifact and asks to send it to Telegram.
- This eval must not call the live FeedContext API.

Write `integrations-plan.json` in the eval output directory with:
- `workflow: "integrations-delivery"`
- `checks_telegram_status_first: true`
- `delivers_only_final_artifacts: true`
- `uploads_drafts: false`
- `requires_user_approval_for_delivery: true`
- `commands`: ordered example command strings for version, integration telegram status, upload, and artifact delivery submission.
- `uses_structured_synthesis_sidecar: true`

Also write `command-trace.json`.
