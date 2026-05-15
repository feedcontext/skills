# Briefing Page

Use this action when the user asks for a digest, briefing page, roundup,
newspaper page, narrative briefing, or HTML-like FeedContext artifact.

The Skill submits a `briefing_page` Artifact Composition Request. `api` turns
the request and visible Feed Items into the server-owned artifact definition
and public viewer output.

## Workflow

1. Follow `README.md` for auth and scope handling.
2. Submit:

   ```bash
   feedcontext artifact compose \
     --artifact-type briefing_page \
     --request "<user request>" \
     --confirm
   ```

3. Add optional scope only when known:

   ```bash
   feedcontext artifact compose \
     --artifact-type briefing_page \
     --request "<user request>" \
     --language zh-CN \
     --query "<search terms>" \
     --subscription-id <subscription-id> \
     --item-id <feed-item-id> \
     --target-topics <count> \
     --preference "<user preference>" \
     --confirm
   ```

4. Return the artifact id, status, and viewer URL. If it is still generating,
   say it is generating and let the viewer page poll.

Do not produce local page DSL files, local HTML, local source indexes, local
reviews, or artifact definition JSON.
