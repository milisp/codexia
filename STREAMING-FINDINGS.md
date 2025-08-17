# Streaming Response Investigation — Findings & Fixes

## Summary
Codexia is already receiving token deltas from the Codex CLI over pipes; the UI simply isn’t applying them. No PTY wrapper is needed. The backend also drops `agent_reasoning_delta` lines due to a missing enum variant, causing noisy log warnings.

## Evidence
- Backend reads stdout line-by-line and emits events:
  - `src-tauri/src/codex_client.rs` uses `BufReader::lines()` and `app.emit("codex-event-<session>", event)`.
- Protocol does not include reasoning deltas:
  - `src-tauri/src/protocol.rs::EventMsg` has `AgentMessageDelta` but not `AgentReasoningDelta`.
- Logs prove streaming arrives:
  - `/tmp/codexia.log` shows many `agent_message_delta` lines (tokens) and repeated parse failures for `agent_reasoning_delta`.
- Frontend doesn’t render deltas:
  - `src/hooks/useCodexEvents.ts` handles `agent_message` but not `agent_message_delta`. No incremental append happens; UI shows loading dots instead.

## Root Cause
- Token deltas arrive but are ignored by the UI.
- Reasoning deltas cause serde parse failures because the enum lacks a matching variant.
- Stderr is piped but never consumed; the UI listens for `codex-error:<session_id>` but nothing emits.

## Fixes (no PTY required)
1) Frontend: accumulate `agent_message_delta` tokens
- In `src/hooks/useCodexEvents.ts`, add a case for `agent_message_delta` that:
  - Ensures a conversation exists for the session.
  - If the last message is assistant, append `delta` via `updateLastMessage`.
  - Else, create a new assistant message seeded with `delta`.

2) Backend: parse (but optionally ignore) reasoning deltas
- In `src-tauri/src/protocol.rs`, add:
  - `AgentReasoningDelta { delta: String },`
- This stops parse errors; UI can keep ignoring these, or we can later surface behind a setting.

3) Types: keep TS in sync
- In `src/types/codex.ts`, extend the `EventMsg` union with:
  - `{ type: 'agent_reasoning_delta'; delta: string }`

4) Optional: better session loading signals
- Handle `turn_complete` (and/or `task_complete`) to call `setSessionLoading(sessionId, false)`. Handle `task_started` to set true.

5) Optional: forward stderr to UI
- In `src-tauri/src/codex_client.rs`, spawn a task to read `stderr` lines and emit `codex-error:<session_id>` so the frontend can display contextual errors. The UI already listens to this channel.

## Patch Sketches

Frontend (streaming): `src/hooks/useCodexEvents.ts`
```ts
case 'agent_message_delta': {
  const conv = conversations.find(c => c.id === sessionId);
  if (!conv) {
    createConversation('New Chat', 'agent', sessionId);
  }
  const target = conversations.find(c => c.id === sessionId);
  const msgs = target?.messages || [];
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'assistant') {
    updateLastMessage(sessionId, last.content + msg.delta);
  } else {
    addMessage(sessionId, {
      id: `${sessionId}-agent-${Date.now()}`,
      role: 'assistant',
      content: msg.delta,
      timestamp: Date.now(),
    });
  }
  break;
}

case 'turn_complete':
  setSessionLoading(sessionId, false);
  break;
```

Backend (protocol): `src-tauri/src/protocol.rs`
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventMsg {
    // ... existing variants ...
    AgentMessageDelta { delta: String },
    AgentReasoningDelta { delta: String }, // NEW
    // ...
}
```

Types (TS): `src/types/codex.ts`
```ts
export type EventMsg =
  | { type: 'agent_message_delta'; delta: string }
  | { type: 'agent_reasoning_delta'; delta: string } // NEW
  // ... other variants
```

Backend (optional stderr relay): `src-tauri/src/codex_client.rs`
```rust
let stderr = process.stderr.take().expect("Failed to open stderr");
let app_err = app.clone();
let sid_err = session_id.clone();
tokio::spawn(async move {
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        // emit raw stderr lines to the UI channel already used
        let _ = app_err.emit(&format!("codex-error:{}", sid_err), &line);
    }
});
```

## Why not a PTY wrapper?
- The Codex CLI already flushes JSON line events; our logs show deltas are arriving.
- The gap is in the UI not appending deltas and the protocol missing a reasoning delta variant.
- A PTY wrapper introduces complexity and hides the underlying issue without addressing it.

## Verification Plan
- Start a session, send a prompt that streams a long response.
- Observe `MessageList` incrementally updating the last assistant message as tokens arrive.
- Confirm loading indicator turns off on `turn_complete`/`task_complete`.
- Confirm no more `Failed to parse codex event: agent_reasoning_delta` in `/tmp/codexia.log`.

