Maintainer Notes: Dev Isolation, Discovery, and Streaming Improvements

Overview
- Added an isolated dev flow that does not affect a production Codexia install and avoids MCP config issues.
- Fixed CLI discovery and improved backend spawning to better match CLI streaming (optional PTY wrapper).
- Implemented reliable streaming in the UI, including raw passthrough to mimic CLI output, execution log streaming, and timing instrumentation to diagnose early lag.
- Addressed token_count protocol events to avoid spurious parse errors.

How To Run (Isolated Dev)
- Default dev: `./codexia-dev`
- With TTY-like streaming: `CODEX_TTY=1 ./codexia-dev`
- Force model reasoning (dev/testing): `CODEX_FORCE_REASONING=1 ./codexia-dev`
- Timing diagnostics (in DevTools): `window.__CODEX_METRICS = true`
- Raw UI passthrough (default on; immediate deltas): leave as‑is. To disable and compare smoothing: `window.__CODEX_RAW_STREAM = false`

Dev Isolation Details
- `scripts/tauri-dev-iso.sh`
  - Sets `HOME` to `./.codex-home` so dev uses an isolated `~/.codex/config.toml` and `auth.json`.
  - Preserves your toolchain by exporting `CARGO_HOME` and `RUSTUP_HOME` from your real home to keep `cargo/rustup` working.
  - Removes `[mcp_servers]` sections from the dev config on launch to avoid related issues.
  - Prints the paths it uses for transparency.
- `scripts/codex-iso.sh`
  - Runs the Codex CLI under the isolated HOME using `bunx`/`npx`, and ensures `auth.json` is available.
- A physical copy of this repo is placed under `~/.codex-home/Projects/codexia-fork` (excluding heavy dirs) for easy browsing inside the app.

CLI Discovery / Backend Launch
- `src-tauri/src/utils/codex_discovery.rs` (existing improvements): supports discovering Codex via `CODEX_PATH`, PATH, and rootless npm installs.
- `src-tauri/src/codex_client.rs`
  - Optional PTY launch (Linux/Unix): set `CODEX_TTY=1` to run via `script -qf -c "<cmd>" /dev/null`, falling back to `stdbuf -oL -eL` if `script` is unavailable. This better matches CLI flush behavior and reduces “freeze then dump” effects caused by pipe buffering.
  - File logging is disabled by default in hot paths. Enable only when needed with `CODEXIA_DEBUG_LOG=1` (and optional `CODEXIA_LOG_PATH`).
  - Adds backend timing metadata to each event: `t_read_ms` (read from stdout) and `t_emit_ms` (just before emit) to help locate delays.

Protocol / Types
- `src-tauri/src/protocol.rs`: Added `TokenCount` to `EventMsg` to accept Codex `token_count` events.
- `src/types/codex.ts`: Added the `token_count` variant to the TypeScript `EventMsg` union.

Frontend Streaming / UI
- `src/hooks/useCodexEvents.ts`
  - Raw passthrough mode is enabled by default: UI appends `agent_message_delta` and `agent_reasoning_delta` immediately as they arrive (mimics CLI). You can disable at runtime via `window.__CODEX_RAW_STREAM = false` to compare with smoothing.
  - Reasoning and exec output streaming supported; execution output is coalesced and rendered continuously.
  - Timing diagnostics: when `window.__CODEX_METRICS = true`, logs per-event parse, delivery, and total latency (from backend read to UI receive).
  - `token_count` events are recognized and ignored by UI for now (ready to surface if desired).
  - While streaming, auto-scroll uses instant mode (no smooth) to avoid scroll animation backlog.
- `src/components/chat/MessageList.tsx`: Thinking and Execution panels show streaming reasoning and tool output, with live cursors during streaming.
- `src/stores/ConversationStore.ts`
  - Reduces main-thread load during streaming: avoids updating `updatedAt` for every small delta and pauses heavy persistence while streaming; persists a `conversationsSnapshot` only at turn/task completion.
  - Adds `streamingActive` to gate persistence and minimize churn; custom storage wrapper skips identical writes.

Known Options / Env Flags
- `CODEX_TTY=1`: run the Codex process under a PTY (or `stdbuf`) to match CLI flush behavior.
- `CODEX_FORCE_REASONING=1`: pass reasoning config (`show_raw_agent_reasoning=true`, etc.) to Codex for rich thinking tokens.
- `CODEXIA_DEBUG_LOG=1`: enable backend file logging (default off) for targeted debugging.
- `window.__CODEX_METRICS = true`: enable timing logs in UI.
- `window.__CODEX_RAW_STREAM = false`: opt out of raw streaming to test smoothing.

Notes / Next Steps
- With raw passthrough enabled and TTY mode available, reasoning and answer deltas should mirror CLI streaming closely. If any startup spikes remain, use `__CODEX_METRICS` to identify whether they arise in backend parsing or delivery, then adjust accordingly (e.g., make PTY default on Linux, or reduce frontend work further during initial seconds).
- If maintainers want a visible token usage row, the `token_count` event is now available to render beneath each assistant message.

Files Touched (Highlights)
- Backend:
  - `src-tauri/src/codex_client.rs` (PTY/stdbuf launch, timing metadata, logging guard)
  - `src-tauri/src/protocol.rs` (TokenCount)
  - `src-tauri/src/utils/logger.rs` (env‑guarded logging)
- Frontend:
  - `src/hooks/useCodexEvents.ts` (raw streaming, timing logs, token_count)
  - `src/components/chat/MessageList.tsx` (streaming panels, scroll behavior)
  - `src/stores/ConversationStore.ts` (streamingActive, snapshot persistence, write dedupe)
  - `src/types/codex.ts` (types update)
- Dev Tooling:
  - `scripts/tauri-dev-iso.sh` (isolated HOME, preserve rustup/cargo, MCP removal)
  - `scripts/codex-iso.sh` (isolated Codex CLI launcher)

Thank you for reviewing these changes. The goal is to make dev runs safe and to ensure the UI’s streaming fidelity matches CLI behavior, while providing optional instrumentation to diagnose any remaining early-phase lag.

