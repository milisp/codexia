Maintainer Notes: Token Streaming Improvements

Overview
- Implemented reliable token streaming in the UI, including raw passthrough to mimic CLI output and execution log streaming.
- Added protocol support for Codex `token_count` events to avoid spurious parse errors.

How To Test Streaming Locally
- Dev server: `./codexia-dev`
- Raw UI passthrough is enabled by default (immediate deltas). To compare with smoothing: set `window.__CODEX_RAW_STREAM = false` in DevTools before sending a message.

Dev‑only environment/isolation tooling is intentionally excluded from this PR to keep the scope focused on streaming.

Backend Launch
- No backend changes required for token streaming in this PR.
- Note (not included): a PTY (TTY) mode was explored to mimic CLI flush behavior, but results were inconsistent in our testing, so it is intentionally not part of this PR.

Protocol / Types
- `src-tauri/src/protocol.rs`: Added `TokenCount` to `EventMsg` to accept Codex `token_count` events.
- `src/types/codex.ts`: Added the `token_count` variant to the TypeScript `EventMsg` union.

Frontend Streaming / UI
- `src/hooks/useCodexEvents.ts`
  - Raw passthrough mode is enabled by default: UI appends `agent_message_delta` and `agent_reasoning_delta` immediately as they arrive (mimics CLI). You can disable at runtime via `window.__CODEX_RAW_STREAM = false` to compare with smoothing.
  - Reasoning and exec output streaming supported; execution output is coalesced and rendered continuously.
  - `token_count` events are recognized and ignored by UI for now (ready to surface if desired).
  - While streaming, auto-scroll uses instant mode (no smooth) to avoid scroll animation backlog.
- `src/components/chat/MessageList.tsx`: Thinking and Execution panels show streaming reasoning and tool output, with live cursors during streaming.
- `src/stores/ConversationStore.ts`
  - Adds fields/methods needed to stream reasoning and tool execution content on the assistant message and track streaming flags.

Known Options (UI)
- `window.__CODEX_RAW_STREAM = false`: opt out of raw streaming to test smoothing.

Notes / Next Steps
- With raw passthrough enabled and TTY mode available, reasoning and answer deltas should mirror CLI streaming closely. If any startup spikes remain, use `__CODEX_METRICS` to identify whether they arise in backend parsing or delivery, then adjust accordingly (e.g., make PTY default on Linux, or reduce frontend work further during initial seconds).
- If maintainers want a visible token usage row, the `token_count` event is now available to render beneath each assistant message.

Files Touched (Highlights)
- Backend:
  - `src-tauri/src/protocol.rs` (TokenCount)
- Frontend:
  - `src/hooks/useCodexEvents.ts` (raw streaming, token_count)
  - `src/components/chat/MessageList.tsx` (streaming panels, scroll behavior)
  - `src/stores/ConversationStore.ts` (streaming flags/fields)
  - `src/types/codex.ts` (types update)

Thank you for reviewing these changes. The goal is to make dev runs safe and to ensure the UI’s streaming fidelity matches CLI behavior, while providing optional instrumentation to diagnose any remaining early-phase lag.
