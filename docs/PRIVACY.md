# Privacy and telemetry

Codexia can send anonymous usage counters. It is **off until you choose**: on first launch (only in builds that have a telemetry endpoint configured) a dialog asks you to pick "Share anonymous usage" or "Don't share". Nothing is preselected. Closing the dialog without choosing is not a choice: nothing is sent and you are asked again at the next launch. You can change your mind any time in Settings > General > Privacy.

## What is sent

Per event: the event name, the app version, the OS (macos, windows, linux, ios, android, web) and the CPU architecture (x86_64, aarch64, unknown). Nothing else.

Event names: `app_active`, `bot_created`, `bot_routine_created`, `bot_run_done`, `bot_run_blocked`, `bot_run_failed`, `bot_ask`.

Each event name is sent at most once per UTC day per device, batched and fire-and-forget.

## What is never sent

No install or user ID, no code, prompts, file paths, bot names or any other content. The app keeps no identifier for this feature; the only local state is a map of event name to the last date it was sent.

## Where it goes

To the maintainer's own Cloudflare Worker, which stores only daily aggregate counts per (event, version, OS, arch).

## Other switches

- Builds without `VITE_TELEMETRY_URL` never send anything and never show the dialog.
- If the browser reports Do Not Track (`navigator.doNotTrack === '1'`), nothing is sent.
