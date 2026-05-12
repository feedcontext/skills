Use the FeedContext Skill docs to plan the authentication behavior for this offline scenario.

Scenario:
- The user asks to use FeedContext.
- There is no known local Skill Session.
- The user did not ask for durable login, cross-device sync, account switching, or an integration requiring a formal account.

Do not call the live FeedContext API. Do not run `feedcontext auth login`.

Write `auth-plan.json` in the eval output directory with:
- `workflow: "auth-anonymous-routing"`
- `uses_anonymous_by_default: true`
- `prompts_for_formal_login_by_default: false`
- `commands`: ordered command strings beginning with version, then auth status, then auth anonymous.
- `formal_login_when`: list of cases where formal login is appropriate.
- `home_override_allowed: false`

Also write `command-trace.json`. It may record only the local helper `version` command if no FeedContext CLI is available in this offline case.
