# Authentication

Use this action when an agent needs to connect, check the installed skill
revision, sign out, switch accounts, or repair stale local authentication state.

## Version

Run:

```bash
node scripts/helper.mjs version
```

Run `version` before other FeedContext actions in an agent session. The helper
prints installed and latest git revisions, whether an upgrade is available, and
the `npx skills install feedcontext` upgrade command. The agent decides whether
to notify the user.

## Login

Run:

```bash
node scripts/helper.mjs login
```

The helper opens Google login through `api.feedcontext.io`, then exits after
printing `pair_code_required`. Ask the user to copy the 6-digit pair code from
the browser, then run:

```bash
node scripts/helper.mjs login --pair-code '<pair-code>'
```

The helper validates OAuth `state`, exchanges the PKCE code, and stores the Skill
Session in the system credential store when available. If the credential store is
unavailable, it falls back to a local file with restrictive permissions and
prints a warning.

## Logout

Run:

```bash
node scripts/helper.mjs logout
```

The helper removes the local Skill Session from the system credential store when
available, removes the fallback session file, and clears any pending login. It
does not call the FeedContext API, so it works even when the current token is
expired or invalid.
