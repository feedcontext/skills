# FeedContext Integration Actions

Use this action doc when the user asks to connect, inspect, or disconnect an
external delivery tool. v1 supports Telegram delivery.

Run `version` first if this is the first FeedContext action in the session:

```bash
node scripts/helper.mjs version
```

## Telegram Status

Check whether the current FeedContext account has a Telegram private chat
linked:

```bash
node scripts/helper.mjs integration telegram status
```

If `connected` is false and the user wants delivery, create a binding link:

```bash
node scripts/helper.mjs integration telegram binding-link
```

Open the returned `binding_url` in Telegram. The user completes binding by
starting the FeedContext bot from that deep link. Afterward, run status again.

## Telegram Health Check

After binding or webhook changes, ask the user to send this command to the bot:

```text
/ping
```

The expected reply is:

```text
pong
```

This verifies Telegram can reach the FeedContext webhook and the bot can reply.

## Disconnect

Disconnecting Telegram is a write action and requires host approval:

```bash
node scripts/helper.mjs integration telegram disconnect --confirm
```

Do not disconnect unless the user explicitly asked to remove Telegram delivery.
