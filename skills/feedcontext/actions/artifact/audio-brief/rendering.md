# Audio Brief Rendering

Use this stage after the Show Script exists and a provider path has been
selected.

The output of this stage is a complete local Audio Brief file. Delivery through
FeedContext is optional and happens after the local file has already passed the
required review gate.

## Provider Diagnostics

Use provider diagnostics before asking the user to choose an Audio Brief
provider when the chosen host tool, local CLI, or configured service exposes a
diagnostic command. The diagnostic output should report provider availability,
invocation shape, expected output format, and the privacy boundary for the
provider path.

## Bing Edge TTS

Provider id: `bing-edge`

Default: yes

Bing Edge TTS is an external provider path when available through a host tool,
local CLI, or explicitly approved implementation. The Show Script text needed
for the Audio Brief is sent to Microsoft's Edge online text-to-speech service.
Availability is outside FeedContext's control and may change.

For longer Audio Briefs, prefer segmented rendering through the chosen provider
path so independent sections can run concurrently and failed sections can be
retried without regenerating the whole show.

Pass `--intro-audio` and `--outro-audio` only to override the bundled defaults.
Pass `--no-default-music` only for explicitly speech-only output.

The segments file should contain the spoken `language`, Show Script `title`,
and an ordered `segments` array. Each segment should carry the selected
provider voice metadata when a concrete host voice was chosen:

```json
{
  "language": "en-US",
  "title": "Daily Audio Brief",
  "segments": [
    {
      "id": "opening-01",
      "speaker": "host_a",
      "speaker_label": "Maya",
      "text": "At first these stories look separate, but there is a shared thread underneath them.",
      "voice_persona_id": "bing-edge/en-US-AvaNeural",
      "voice": "en-US-AvaNeural"
    },
    {
      "id": "opening-02",
      "speaker": "host_b",
      "speaker_label": "Noah",
      "text": "And that thread may matter more than any single headline on its own.",
      "voice_persona_id": "bing-edge/en-US-GuyNeural",
      "voice": "en-US-GuyNeural"
    }
  ]
}
```

Exact host `provider_voice` values from the Show Script take precedence over
provider defaults when the chosen provider supports explicit voice selection.

## Segment Manifest And Resume

For any non-trivial Audio Brief, create or preserve a segment manifest before
provider rendering. The manifest is the stable contract between the reviewed
Show Script, the selected provider path, and final assembly. A Skill Local
Helper may create the manifest from the Show Script when available:

```bash
node scripts/helper.mjs audio segments \
  --script-file /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.script.json \
  --out /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.segments.json
```

Render each segment to a stable file path derived from the segment id. When a
provider path supports resume, reuse any segment file that exists, is non-empty,
matches the manifest entry, and can be probed or played by the local audio
tooling. Retry only missing, empty, failed, or manifest-mismatched segment
files. Do not regenerate the entire Audio Brief just because one segment failed.

When the Skill Local Helper is available, use `audio render --resume` to inspect
the segment directory and write a render manifest before retrying provider work:

```bash
node scripts/helper.mjs audio render \
  --segments-file /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.segments.json \
  --segment-dir /tmp/feedcontext/2026-05-12-daily-briefing/segments \
  --manifest-out /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.render-manifest.json \
  --retry-out /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.retry-queue.json \
  --resume
```

This command identifies reusable, missing, or empty segment files and may write
a retry queue containing only the segments that still need provider work. It
does not call the provider and does not by itself create the final assembled
audio file.

After the render manifest reports `ready_for_assembly: true`, use the Skill
Local Helper to assemble the complete local Audio Brief file:

```bash
node scripts/helper.mjs audio assemble \
  --render-manifest /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.render-manifest.json \
  --out /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.m4a \
  --manifest-out /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.assembly-manifest.json
```

`audio assemble` is deterministic local artifact rendering. It refuses render
manifests that are not ready, preserves the reviewed segment order, writes the
final local audio file, records the assembly inputs, embeds basic player
metadata through `ffmpeg`, and writes a `.lyrics.txt` playback-text sidecar next
to the final audio file. Use `--intro-audio` and `--outro-audio` only for
custom music handoff. Use `--no-default-music` for speech-only output.

Record segment status in a render manifest next to the final artifact. The
manifest should make resumed files, retried files, provider errors, final
assembly inputs, and review repair results inspectable. This is local workflow
state, not an api resource and not a user-facing source appendix.

For Chinese Audio Briefs, avoid raw provider defaults when generating final
audio. The default Edge voices can sound too broadcast-like or too childlike;
the fixed Chinese Edge defaults use `林晓` and `周熙` persona voices with lower
pitch and moderately reduced rate because that tested better than both raw
defaults and slower tuning variants. Treat it as a usable preview baseline, not
a finished quality ceiling.

## Intro And Outro Music

Podcast-like final outputs should include short intro and outro music unless the
user explicitly asks for speech-only output. The skill includes bundled default
assets at `assets/audio/intro.mp3` and `assets/audio/outro.mp3`; use those
stable defaults instead of asking the agent to improvise music at render time.

Before final assembly:

1. Use the bundled default intro and outro assets when the user did not provide
   custom music.
2. Use `--intro-audio` and `--outro-audio` only when the user supplied custom
   assets or explicitly approved replacement music.
3. Use `--no-default-music` only when the user explicitly asks for speech-only
   output or rejects the bundled defaults.

Use the chosen provider path to prepend intro and append outro audio during
final assembly, or use local `ffmpeg` assembly when the provider only returns
speech segments. For longer Audio Briefs, generate by section and assemble the
final audio file so a failed section can be retried without regenerating the
whole show.

Final assembly is deterministic local artifact rendering. It may concatenate
reviewed provider segment outputs, apply bundled intro and outro music, write
M4A metadata, attach artwork, and preserve playback text sidecars. It should
not change the Show Script wording, provider choice, segment order, or evidence
interpretation.

## Timed Script Playback Text

A Timed Script is playback-oriented text derived from the reviewed Show Script
and rendered audio. It exists so audio players can show lyrics-style or
caption-style text while the Audio Brief is playing. It is not the editable
Show Script, not a transcript of an external podcast, and not a source or
evidence appendix.

For final user-facing files that need playback text, prefer M4A. MP3 may remain
available as a compatibility export, but MP3 lyrics metadata support varies by
player and should not be treated as the best default when playback text matters.

Final rendering should embed Timed Script metadata into the final audio file by
default when the output format supports it. Use an explicit opt-out when the
user asks for audio-only output. Preserve any generated sidecar text track next
to the final audio for retry or manual use.

Use `ffmpeg` and `ffprobe` as the default local tooling for final M4A assembly,
AAC container output, duration inspection, and embedded playback text metadata.
If either tool is missing, unavailable, or fails to write compatible metadata,
keep the final audio file when available, preserve the sidecar text track, and
mark the embedding path as failed in the render manifest.

Final audio assembly should include basic title, artist, and album metadata so
desktop audio players recognize the local file as a normal track and can expose
its playback text panel. The player-facing title should come from the Show
Script title passed through the segments file when available. Treat
`--final-out` as the filesystem path, not the display title; use a safe file
stem only as a fallback when no Show Script title or explicit display title is
available.

Final audio assembly should also preserve Audio Brief Artwork.

Artwork capability contract:

- Treat host image generation as an abstract capability. It may be native,
  plugin-backed, externally configured, MCP-backed, or CLI-backed; do not require
  a specific tool name such as `imagegen`.
- If the host agent can generate an image and hand off a local file, create a
  square, unbranded, text-free artwork base from the reviewed Show Script and
  synthesis context. Save it as `<audio-stem>.artwork-base.png` or
  `<audio-stem>.artwork-base.jpg`.
- The generated base image must not contain title text, subtitles, dates,
  captions, logos, watermarks, or provider branding. The final assembly path
  owns the FeedContext brand overlay and audio metadata owns the title.
- Pass the local base image to the chosen rendering or assembly path when that
  path supports artwork embedding.
- If image generation is unavailable, fails, or cannot produce a local file for
  handoff, use a simple text-free local template or continue without generated
  artwork.

Apply the FeedContext brand mark as the final post-processing step for both
generated and template artwork. Save the final cover next to the audio as
`<audio-stem>.cover.png` and attempt to embed it into the final audio file using
player-compatible cover encoding for the target container. The sidecar may
remain PNG even when the M4A embedding path writes Apple-compatible `covr`
artwork metadata or converts the attached artwork to JPEG/MJPEG for fallback
compatibility. If embedding fails, keep the audio and sidecar image and record
the artwork embedding failure in the render manifest.

For Telegram delivery, do not rely on embedded audio duration, artwork, or
artist metadata. Prepare a separate JPEG thumbnail no larger than 320x320 and
less than 200 KB, then pass it to the supported artifact delivery path with
`--telegram-thumbnail-file` along with explicit
`--telegram-audio-duration-seconds`, `--telegram-audio-title`, and
`--telegram-audio-performer` values. Round the rendered audio duration up to the
nearest whole second.

Write the full spoken playback text to the audio file's lyrics or unsynchronized
lyrics metadata when supported. Use comment or description metadata only as a
short compatibility fallback that points to the sidecar or summarizes that
playback text is available; do not duplicate the full long script into comment
or description fields.

The embedded text should contain the spoken script text with player-facing host
or speaker labels when that improves readability. Prefer the host display names
from the Show Script. Do not leak internal IDs such as `host_a` or `host_b`
when display names are available:

```text
Host A: Welcome back. Today we are starting with...
Host B: So the practical question is...
```

Do not include source appendices, evidence-depth notes, URLs, generation
metadata, or provider diagnostics in embedded playback text.

v1 embedded Timed Script metadata should prioritize unsynchronized full spoken
text. Add synchronized timing only from reliable audio timing data, such as the
actual rendered duration of each TTS segment. Do not invent fixed per-line
durations.

Also preserve an LRC-style `.lrc` sidecar for synchronized lyric displays in
players or previews that support LRC. Apple Music's catalog-style synchronized
lyrics view does not reliably activate from ordinary local `lyrics` metadata,
LRC text stored in a metadata field, or a local subtitle track, so do not treat
that view as the v1 acceptance target for generated local files.

If a provider does not return word-level timing data, the chosen assembly path
may still create segment-level synchronized `.lrc` cues by reading the real
rendered duration of each segment. If the assembly path cannot read actual
segment durations, do not emit a fake synchronized track; preserve only the
unsynchronized playback text and mark synchronized timing as unavailable in the
render manifest.

If embedding Timed Script metadata fails, keep the final audio file, preserve a
sidecar text track such as `.lyrics.txt` or `.vtt`, and mark the embedding
failure plus the error reason in the render manifest instead of failing the
whole render.

## Final Audio Review

Final user delivery is M4A-first. Run Final Audio Review after rendering and
before handing the Audio Brief to the user or submitting it for delivery. The
review may be performed by the host audio tool, a local metadata inspection
tool, or the current agent reading `ffprobe` output and sidecar files.

The review is a hard gate for the final M4A file. It must pass all checks:

- title metadata is embedded;
- artist metadata is embedded;
- album metadata is embedded;
- album artist metadata is embedded;
- cover artwork is embedded in the audio container;
- Timed Script playback text is embedded in the audio container.

The review path may repair missing M4A metadata in place. It should use the
render manifest for display title recovery and the adjacent `.cover.png` and
`.lyrics.txt` sidecars as repair inputs. This repair does not rewrite the audio
program content; it only updates metadata and attached artwork in the same
final M4A file.

When the Skill Local Helper is available, run review after assembly:

```bash
node scripts/helper.mjs audio review \
  --file /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.m4a \
  --assembly-manifest /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.assembly-manifest.json \
  --out /tmp/feedcontext/2026-05-12-daily-briefing/audio-brief.review.json
```

`audio review` writes a review manifest with `ready`, `ready_repaired`, or
`blocked`. By default it attempts an in-place metadata repair using `ffmpeg`
when required sidecars are available, then verifies the repaired file with
`ffprobe`. A `ready_repaired` verdict is deliverable; a `blocked` verdict is
not.

Sidecars are required recovery material, not acceptance substitutes. A final
M4A that only has `.cover.png`, `.lyrics.txt`, or `.lrc` beside it must not be
delivered until `audio review` reports `ready` or `ready_repaired`.

Use `--no-repair` only for diagnostics. A `blocked` review verdict means the
final file is not deliverable; fix the render inputs or sidecars, then rerun
review.
