Use the FeedContext Skill docs to plan troubleshooting behavior for this offline scenario.

Scenario:
- A FeedContext CLI action returns unauthorized.
- A previous login attempt may have expired.
- This eval must not call the live FeedContext API.

Write `troubleshooting-plan.json` in the eval output directory with:
- `workflow: "troubleshooting"`
- `checks_auth_status_first: true`
- `retries_login_when_pair_code_expired: true`
- `does_not_override_home: true`
- `uses_high_level_commands_before_raw_api: true`
- `unsupported_path_guidance`: mention documented v1 paths and high-level commands.
- `write_refused_guidance`: mention host approval and `--confirm`.

Also write `command-trace.json`.
