# Troubleshooting

Use `auth.md` for the normal `version`, `login`, pair-code, and `logout` flows.
Use this doc for recovery paths.

## Login Does Not Complete

- Confirm the browser opened an `api.feedcontext.io` Google login URL.
- Confirm the browser shows a FeedContext pair code after Google login.
- Confirm the pair code came from the newest browser page for the printed
  `login_session`.
- If multiple logins are pending, re-run `login --pair-code` with the printed
  `--login-session <id>`.
- Do not override `HOME` for login commands. Pending login state is temporary
  OS handoff state, while `FEEDCONTEXT_STATE_DIR` only affects persistent
  fallback CLI Session files.
- Retry `feedcontext login` if the pending pair code expired, then
  use the newest browser page and ignore older tabs.

## Session Storage Warning

The CLI prefers the system credential store. If that is unavailable, it
stores the CLI Session in a local fallback file with restrictive permissions
and prints a warning. Tokens are not printed.

## Unauthorized API Calls

Clear the local session, then run login again:

```bash
feedcontext logout
feedcontext login
```

Then retry the read or approved write command.

## Write Refused

Write commands require host approval and `--confirm`. Re-run the command with
`--confirm` only after approval.

## Unsupported API Path

The CLI allows only documented v1 paths. Use high-level commands when possible.
If a new public route is genuinely required, update the published CLI and
`actions/api.md` together.
