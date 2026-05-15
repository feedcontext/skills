# Authentication

Use this action when an agent needs to connect, check the FeedContext CLI
revision, create an anonymous Skill Session, sign out, switch accounts, or
repair stale local authentication state.

## Version

Run:

```bash
feedcontext version
```

Run `version` before other FeedContext actions in an agent session. The CLI
prints package metadata and confirms that the command is available.

## Status

Run:

```bash
feedcontext auth status
```

If it prints `authenticated: true`, continue with the current Skill Session. If
`is_anonymous` is true, the session is anonymous and is intended for local Skill
and CLI use.

If it prints `authenticated: false`, create an anonymous Skill Session unless
the user explicitly asked for formal login:

```bash
feedcontext auth anonymous
```

Do not prompt for browser login merely because no session exists. Anonymous
Skill Sessions reduce first-run friction while still authenticating public `/v1`
reads, writes, and artifact definition submissions through the CLI.

## Anonymous Limits

Anonymous users may create up to 100 active Subscriptions. When the user is
near that limit, or when an OPML import would exceed it, explain that formal
login is required for durable long-term use and larger account-backed
management. For OPML imports, ask the user whether to continue with a smaller
approved subset or run formal login first.

Anonymous use is only supported through the FeedContext Skill and CLI. Do not
describe it as a Dashboard or web-console mode.

## Formal Login

Run:

```bash
feedcontext auth login
```

The CLI opens Google login through `api.feedcontext.io`, then exits after
printing `pair_code_required`, `login_session`, and `pending_login_path`. Ask
the user to copy the 6-digit pair code from the browser opened by that exact
login attempt, then stop and wait for the user's next message. Do not poll,
continue unrelated FeedContext reads, infer the login result while waiting for
the code, or repeatedly start new login attempts while the user is copying a
code. `pending_login_path` is an OS temporary file for this one login handoff,
not persistent CLI Session storage. When the user sends only the 6-digit code,
complete the exchange directly:

```bash
feedcontext auth login --pair-code '<pair-code>'
```

If more than one login is pending, pass the printed login session explicitly:

```bash
feedcontext auth login --pair-code '<pair-code>' --login-session '<login_session>'
```

Do not override `HOME` for login commands. If an agent needs isolated persistent
fallback session state, set `FEEDCONTEXT_STATE_DIR`; it does not control the
temporary pending login handoff.

The CLI validates OAuth `state`, exchanges the PKCE code, and stores the CLI
Session in the system credential store when available. If the credential store is
unavailable, it falls back to a local file with restrictive permissions and
prints a warning.

If formal login starts while the local session is anonymous, the resulting
formal account should receive the union of the existing anonymous Subscriptions
and the formal account's existing Subscriptions. For a new formal account, the
anonymous account is upgraded. For an existing formal account, merge the
anonymous account data into that account. Do not delete local artifacts as part
of login.

## Logout

Run:

```bash
feedcontext auth logout
```

The CLI removes the local CLI Session from the system credential store when
available, removes the fallback session file, and clears temporary pending
login files. It does not call the FeedContext API, so it works even when the
current token is expired or invalid. It applies to both anonymous and formal
Skill Sessions.
