This multi-turn live eval verifies that the FeedContext Skill preserves explicit artifact continuity across turns.

Rules for every turn:
- Use the real FeedContext API through the FeedContext CLI and the provided live eval account session.
- Run FeedContext CLI `version` before the first FeedContext action.
- Run `feedcontext auth status` before reading account data.
- Do not run login, anonymous auth, logout, subscription writes, raw token inspection, or any mutation.
- Keep a single `command-trace.json` for the whole conversation. Append later-turn commands instead of replacing earlier commands.

Turn-specific requirements:

Turn 1, "输出最近新闻":
- Run `feedcontext item list --all`.
- Write `feed-items.snapshot.json` with real Feed Item discovery records.
- Write `turn-1-summary.json` with `workflow: "recent_news_turn"` and `used_live_api: true`.

Turn 2, "基于刚才的内容输出我的简报":
- Read `feed-items.snapshot.json` from turn 1.
- Do not re-fetch Feed Items unless the turn 1 snapshot is invalid or empty.
- Write and validate `briefing.synthesis.json`.
- Write `synthesis-review.json` with `verdict: "ready"` and `ready_for_artifact: true`.
- The synthesis scope request must include `基于刚才的内容输出我的简报`.

Turn 3, "再给我音频简报":
- Read `briefing.synthesis.json` and `synthesis-review.json`.
- Do not produce plain narration directly.
- Write and validate `show-script.json`.
- Write `script-review.json` with `verdict: "ready"` and `ready_for_audio: true`.
- Stop before local segment manifests, local provider rendering, local assembly,
  or local audio metadata review. Do not create local podcast/audio files.
