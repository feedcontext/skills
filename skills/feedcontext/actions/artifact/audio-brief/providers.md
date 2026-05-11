# Audio Brief Providers

FeedContext does not bind to one audio provider. Use this stage after the Show
Script exists and the user wants audio.

## Discovery

When the user has not specified a provider, discover options in this order:

1. Host agent skills or exposed tools that can generate audio.
2. Local CLIs or installed applications that can generate speech audio.
3. Configured external services available through environment variables or
   credentials.
4. Provider options the user could install or configure.

When more than one provider path is available, ask the user which one to use.
Present the trade-offs by listening quality, multi-host support, expected cost
or quota use, privacy boundary, and current local availability.

Selecting a third-party provider path allows the agent to send the Show Script
needed for this Audio Brief to that provider. For private or local-only
requests, use a local provider path or stop after script generation.

If no usable provider is available, the workflow should still complete the
Structured Synthesis and Show Script artifacts, then stop in a resumable
ready-to-generate-audio state.

## Provider Classes

- Production audio providers are external or host-agent paths intended for a
  podcast-like final output, such as a configured high-quality TTS or AI audio
  service. Before using one, disclose that the Show Script needed for this Audio
  Brief will be sent to that provider.
- Local fallback TTS paths, such as operating-system speech commands, are useful
  for drafts, previews, accessibility checks, or private local-only requests.
  Do not silently use a local fallback TTS path as the final podcast-like output
  when the user asked for a podcast or Audio Brief.
- Unavailable providers should leave the workflow in a resumable state with the
  Structured Synthesis, machine-readable Show Script, and readable script saved.

If a production provider is configured and the user has not specified a
provider, recommend that provider and state the privacy boundary. If multiple
production providers are configured, ask which one to use. If only local
fallback TTS is available, ask before generating audio from it.

When a provider supports voice or speaker selection, select voices that match
the script's spoken language. Do not read one language with a voice intended for
another language. Pass the Show Script `language` into the chosen provider path
when that path supports it; only select a concrete provider voice when it is
known to support that spoken language.

For multi-host scripts, preserve each turn as a separate TTS segment and switch
voices by `speaker`. Use host `provider_voice` when present; otherwise choose
stable provider voices for each host before rendering. Do not flatten a
two-host script into one text file with speaker labels.

Voice Personas are provider-specific host identities. Provider renderers map
them to concrete provider voices, stable host display names, and any supported
prosody settings. The Bing Edge path currently fixes Chinese defaults to `林晓`
and `周熙`, and English defaults to `Maya` and `Noah`.

The skill does not require a bundled default TTS provider. If the user has not
specified a provider, choose from currently available host tools, local CLIs,
configured services, or explicitly installable provider paths after preserving
the privacy boundary in the response or artifact notes.

## Provider Cookbook

Use provider-specific documentation before calling audio provider APIs directly.
This skill should grow concrete provider notes for configured production paths,
including required environment variables, voice discovery, text-to-speech
request shape, common error handling, segmentation, and output assembly.

At minimum, provider notes should cover:

- ElevenLabs: `ELEVENLABS_API_KEY` or `XI_API_KEY`, voice discovery, text to
  speech request shape, plan or quota errors, and long-script segmentation.
- OpenAI audio: `OPENAI_API_KEY`, model and voice selection, output format,
  errors, and long-script segmentation.
- Bing Edge TTS: availability, voice selection, output format, external service
  boundary, and long-script segmentation when the host has a usable path.
- Local fallback TTS: platform command availability and the fact that local TTS
  is draft or preview quality unless the user explicitly accepts it.

Use provider diagnostics before rendering when the chosen provider path exposes
them. Keep direct provider API calls as a fallback only when the provider
cookbook explicitly describes the call shape.
