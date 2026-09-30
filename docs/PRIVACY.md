# Privacy and telemetry

Codexia can send anonymous usage counters, mainly to measure Bots. It is **off until you choose**, and it does not even ask until you have created your first bot: with no bots, nothing is asked and nothing is sent. Once you have a bot, and only in builds that have a telemetry endpoint configured, a dialog asks you to pick "Share anonymous usage" or "Don't share". Nothing is preselected. Closing the dialog without choosing is not a choice: nothing is sent and you are asked again at the next launch. You can change your mind any time in Settings > General > Privacy.

The choice is stored once per machine in `~/.codexia/telemetry.json`, and the Codexia backend does the sending, so the desktop app, the browser and the phone all share the same answer and the same once-a-day limit.

## What is sent

Per event: the event name, the app version, the OS (macos, windows, linux, ios, android, web) and the CPU architecture (x86_64, aarch64, unknown). Nothing else.

Event names: `app_active`, `bot_created`, `bot_routine_created`, `bot_run_done`, `bot_run_blocked`, `bot_run_failed`, `bot_ask`.

Each event name is sent at most once per UTC day per machine, fire-and-forget. The OS and architecture are those of the machine running the Codexia backend.

## What is never sent

No install or user ID, no code, prompts, file paths, bot names or any other content. The app keeps no identifier for this feature; the only local state is `~/.codexia/telemetry.json`: your choice (`unset`, `granted` or `denied`) and a map of event name to the last date it was sent. Delete the file to reset it.

## Where it goes

To the maintainer's own Cloudflare Worker, which stores only daily aggregate counts per (event, version, OS, arch).

## Other switches

- Builds without a telemetry endpoint never send anything and never show the dialog. The endpoint is compiled into the backend from the `CODEXIA_TELEMETRY_URL` environment variable at build time (in CI, the `CODEXIA_TELEMETRY_URL` repository variable; empty or unset means disabled). To build with it locally: `CODEXIA_TELEMETRY_URL=https://... bun tauri build`.
- If the `DO_NOT_TRACK=1` environment variable is set when Codexia starts, nothing is sent and the dialog is not shown.
