# Authentication

Use this action when an agent needs to connect, check the FeedContext CLI
revision, sign out, switch accounts, or repair stale local authentication state.

## Version

Run:

```bash
feedcontext version
```

Run `version` before other FeedContext actions in an agent session. The CLI
prints package metadata and confirms that the command is available.

## Login

Run:

```bash
feedcontext login
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
feedcontext login --pair-code '<pair-code>'
```

If more than one login is pending, pass the printed login session explicitly:

```bash
feedcontext login --pair-code '<pair-code>' --login-session '<login_session>'
```

Do not override `HOME` for login commands. If an agent needs isolated persistent
fallback session state, set `FEEDCONTEXT_STATE_DIR`; it does not control the
temporary pending login handoff.

The CLI validates OAuth `state`, exchanges the PKCE code, and stores the CLI
Session in the system credential store when available. If the credential store is
unavailable, it falls back to a local file with restrictive permissions and
prints a warning.

## Logout

Run:

```bash
feedcontext logout
```

The CLI removes the local CLI Session from the system credential store when
available, removes the fallback session file, and clears temporary pending
login files. It does not call the FeedContext API, so it works even when the
current token is expired or invalid.
