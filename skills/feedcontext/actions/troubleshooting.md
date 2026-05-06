# Troubleshooting

## Login Does Not Complete

- Confirm the browser opened an `api.feedcontext.io` Google login URL.
- Confirm the callback is bound to `127.0.0.1`.
- Retry `node dist/feedcontext.mjs login` if the local callback port is busy.

## Session Storage Warning

The helper prefers the system credential store. If that is unavailable, it
stores the Skill Session in a local fallback file with restrictive permissions
and prints a warning. Tokens are not printed.

## Unauthorized API Calls

Run login again:

```bash
node dist/feedcontext.mjs login
```

Then retry the read or approved write command.

## Write Refused

Write commands require host approval and `--confirm`. Re-run the command with
`--confirm` only after approval.

## Unsupported API Path

The helper allows only documented v1 Subscription and Feed Item paths. Use
`actions/api.md` for the current allowlist.
