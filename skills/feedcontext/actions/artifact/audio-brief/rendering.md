# Audio Brief Rendering

Use this stage after the Show Script exists and a provider path has been
selected.

## Provider Doctor

Use provider diagnostics before asking the user to choose an Audio Brief
provider:

```bash
node scripts/helper.mjs audio provider doctor
node scripts/helper.mjs audio provider doctor --provider bing-edge
```

The doctor output reports provider availability, invocation shape, and the
privacy boundary for each provider path.

## Bing Edge TTS

Provider id: `bing-edge`

Default: yes

Bing Edge TTS uses the helper's built-in Edge Read Aloud client to call
Microsoft Edge's online text-to-speech service. The implementation follows the
same Microsoft Edge Read Aloud API shape used by `MsEdgeTTS`, but it is bundled
directly into `scripts/helper.mjs` so installed skills do not need a Python
package, an external `edge-tts` CLI, or runtime `node_modules`. It is still an
external provider path: the Show Script text needed for the Audio Brief is sent
to Microsoft's Edge online text-to-speech service. Availability is outside
FeedContext's control and may change.

Diagnostic:

```bash
node scripts/helper.mjs audio provider doctor --provider bing-edge
```

Helper-backed generation from a prepared spoken text file:

```bash
node scripts/helper.mjs audio render \
  --text-file feedcontext-audio-brief-2026-05-07.spoken.txt \
  --language en-US \
  --out feedcontext-audio-brief-2026-05-07.bing-edge.mp3
```

Convert a Show Script into speaker-aware TTS segments:

```bash
node scripts/helper.mjs audio segments \
  --script-file feedcontext-audio-brief-2026-05-07.script.json \
  --out feedcontext-audio-brief-2026-05-07.segments.json
```

For longer Audio Briefs, prefer segmented rendering so independent sections can
run concurrently and failed sections can be retried without regenerating the
whole show:

```bash
node scripts/helper.mjs audio render \
  --segments-file feedcontext-audio-brief-2026-05-07.segments.json \
  --out-dir feedcontext-audio-brief-2026-05-07-segments \
  --concurrency 4 \
  --language en-US \
  --intro-audio intro.mp3 \
  --outro-audio outro.mp3 \
  --final-out feedcontext-audio-brief-2026-05-07.bing-edge.mp3 \
  --out feedcontext-audio-brief-2026-05-07.bing-edge.segments.json
```

The segments file should contain the spoken `language` and an ordered
`segments` array:

```json
{
  "language": "en-US",
  "segments": [
    {
      "id": "opening-01",
      "speaker": "host_a",
      "text": "At first these stories look separate, but there is a shared thread underneath them.",
      "voice": "en-US-AvaNeural"
    },
    {
      "id": "opening-02",
      "speaker": "host_b",
      "text": "And that thread may matter more than any single headline on its own.",
      "voice": "en-US-GuyNeural"
    }
  ]
}
```

If `--voice` is omitted, Bing Edge TTS chooses a default voice from the script
language and host gender metadata.

Use intro and outro music when the user asks for a podcast-like final output and
music assets are available. The helper can prepend `--intro-audio` and append
`--outro-audio` while assembling `--final-out`. If music assets are not
available, preserve the speech segments and state that the final bed/jingle
asset is missing instead of pretending the audio has a podcast opening.

Use Bing Edge TTS as the default production audio provider when the user accepts
the external service boundary. For longer Audio Briefs, generate by section and
assemble the final audio file so a failed section can be retried without
regenerating the whole show.
