# Audio Brief Provider Boundary

FeedContext v1 renders Audio Briefs on the server with Edge TTS. Use this doc
only to preserve the provider boundary while preparing the Show Script DSL.
Agents do not choose a local provider for normal Audio Brief rendering.

## Discovery

The agent should not ask the user to choose a TTS provider unless the user
explicitly asks for a non-FeedContext local preview outside the normal artifact
workflow. The normal workflow submits the reviewed Artifact Definition Bundle;
`api` sends the needed Show Script segments to Edge TTS during server rendering.

## Provider Classes

- Server Edge TTS is the normal production provider path and requires no user
  token.
- Local fallback TTS is only a preview outside the normal FeedContext artifact
  workflow and must not be submitted as the final Audio Brief.
- If server rendering is unavailable, preserve the reviewed Structured
  Synthesis, Show Script, reviews, and bundle in a resumable state.

When a provider supports voice or speaker selection, select voices that match
the script's spoken language. Do not read one language with a voice intended for
another language. Pass the Show Script `language` into the chosen provider path
when that path supports it; only select a concrete provider voice when it is
known to support that spoken language.

For multi-host scripts, preserve each turn as a separate TTS segment and switch
voices by `speaker`. Use host `provider_voice` when present; otherwise choose
stable provider voices for each host before rendering. Do not flatten a
two-host script into one text file with speaker labels.

Voice Personas are server renderer inputs. The server renderer maps them to
concrete Edge TTS voices, stable host display names, and supported prosody
settings. Speaker labels remain metadata and must not be read aloud.
