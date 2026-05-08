# Audio Brief Run Feedback

Use this stage after script-only handoff or final audio generation. The goal is
to preserve actionable feedback for future Audio Brief runs without turning
FeedContext into a personalization system or hidden learning loop.

Run Feedback is a local artifact. It is not a Feed Item, not a Structured
Synthesis replacement, not an api resource, and not long-term FeedContext user
memory.

## When To Write

Write a Run Feedback note when any of these are true:

- the user gave explicit feedback about the script, audio, style, pacing,
  source handling, or assets;
- script review required `revise` or `blocked` before reaching `ready`;
- audio rendering had provider, segment, asset, or assembly issues;
- the final artifact revealed a repeatable process improvement;
- the run used custom intro, outro, voice, provider, or review settings that
  may be useful next time.

If nothing notable happened, write a short note saying no reusable feedback was
captured.

## File Shape

Keep the note next to the script and audio artifacts. Use a name such as:

```text
feedcontext-audio-brief-2026-05-08.run-feedback.md
```

Use this structure:

```md
# Audio Brief Run Feedback

- source_synthesis: path/to/brief.synthesis.json
- show_script: path/to/brief.script.json
- readable_script: path/to/brief.script.md
- final_audio: path/to/brief.mp3
- review_verdict_history: ready | revise -> ready | blocked -> revise -> ready

## What Worked

- ...

## What Failed

- ...

## User Feedback

- ...

## Review Lessons

- ...

## Asset Feedback

- ...

## Provider Feedback

- ...

## Next Run Adjustments

- ...
```

## What To Capture

- `what_worked`: practices that improved the script or audio, such as Story
  Setup, shorter turns, or a specific review rule.
- `what_failed`: repeatable problems, such as AI-flavored phrasing, weak Story
  Setup, overlong turns, poor pacing, or asset mismatch.
- `user_feedback`: only explicit user feedback from the current run. Do not
  infer private preferences beyond what the user said.
- `review_lessons`: why the review verdict changed, which hard gates failed,
  and which edits made the script ready.
- `asset_feedback`: whether bundled or custom intro/outro assets fit the output,
  including volume, length, tone, or mismatch.
- `provider_feedback`: provider quality, speed, failures, retry behavior,
  segmentation issues, or voice mismatches.
- `next_run_adjustments`: concrete instructions for future similar runs.

## Future Use

At the start of a future Audio Brief run, the agent may read relevant Run
Feedback notes when they are nearby or explicitly provided in context. Apply
feedback only when it fits the current user request, current Feed Items, and
current Structured Synthesis.

Current user instructions, current evidence, and the latest review verdict take
priority over prior feedback.

## Boundaries

- Do not store secrets, access tokens, private account details, or raw hidden
  prompts in Run Feedback.
- Do not treat Run Feedback as an automatic profile of the user.
- Do not use prior feedback to skip Feed Item reading, Structured Synthesis, or
  Script Review.
- Do not let prior feedback override the current user's explicit request.
- Do not write broad claims such as "the user always prefers..." unless the user
  explicitly stated that preference in this run.
