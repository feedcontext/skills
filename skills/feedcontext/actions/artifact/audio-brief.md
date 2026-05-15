# Audio Brief

Use this action when the user asks for a podcast-like audio briefing, spoken
briefing, listening version, commute briefing, or long-form audio explanation.

The Skill submits an `audio_brief` Artifact Composition Request. `api` owns
topic grouping, Show Script generation, internal review, TTS rendering, retry,
assembly, storage, playback, and the public viewer URL.

## Workflow

1. Follow `README.md` for auth and scope handling.
2. Submit:

   ```bash
   feedcontext artifact compose \
     --artifact-type audio_brief \
     --request "<user request>" \
     --confirm
   ```

3. Add optional scope only when known:

   ```bash
   feedcontext artifact compose \
     --artifact-type audio_brief \
     --request "<user request>" \
     --language zh-CN \
     --query "<search terms>" \
     --subscription-id <subscription-id> \
     --item-id <feed-item-id> \
     --target-topics <count> \
     --preference "<runtime, tone, or host preference>" \
     --confirm
   ```

4. Return the artifact id, status, and viewer URL. If audio rendering is still
   running, say it is generating and let the viewer page poll.

Do not create local Structured Synthesis, Show Script, readable script, script
review, sizing review, audio segments, provider logs, assembled audio files, or
metadata sidecars.
