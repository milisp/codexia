# Web Server Design

## Purpose

The web server provides browser-accessible APIs and a WebSocket event stream for Codexia.
It is used by the web frontend and can also be used for remote control scenarios.

## Scope

- HTTP API endpoints under `/api/*`
- Health endpoint (`/health`)
- WebSocket endpoint (`/ws`) for server-pushed events
- Static file serving for the built frontend (`dist/`)

## Key Modules

### `src-tauri/src/web` move to `web/` now

- `src-tauri/src/web/server.rs`
  - Starts the Axum server and binds the TCP listener.
- `src-tauri/src/web/router.rs`
  - Registers all routes (`/health`, `/ws`, `/api/*`) and fallback static serving.
- `src-tauri/src/web/websocket.rs`
  - Handles WebSocket upgrade and broadcasts events to connected clients.
- `src-tauri/src/web/handlers.rs`
  - Implements HTTP handlers for API routes.
- `src-tauri/src/web/types.rs`
  - Shared server state (`WebServerState`) and error response types.

## Runtime Architecture

The server is built on Axum and uses shared state (`WebServerState`) with:

- Codex state (`AppState`)
- Claude Code session state (`CCState`)
- Web terminal state
- Broadcast channel sender (`event_tx`)

The broadcast channel is used to fan out events to all WebSocket clients.

## Ports and Configuration

- Frontend dev server (Vite): `1420` (fixed)
- Web backend server default: `7420`
- Backend port environment variable: `VITE_WEB_PORT`

When running web mode, backend port resolution is:

1. `VITE_WEB_PORT`
2. CLI override: `--port` / `--web-port`
3. Default: `7420`

Frontend API URL construction uses `VITE_WEB_PORT` and targets:

- `http://<hostname>:<port>/api/*` for HTTP
- `ws://<hostname>:<port>/ws` for WebSocket

## Route Design

### Core Routes

- `GET /health` for liveness checks
- `GET /ws` for WebSocket upgrade and event streaming
- `POST|GET /api/...` for codex, filesystem, git, notes, terminal, cc, mcp, and usage

### Static and SPA Fallback

`router.rs` resolves the `dist/` directory and serves static assets.
Unknown paths fallback to `index.html`, enabling SPA routing.

## WebSocket Design

`/ws` is broadcast-based:

1. Client connects and upgrades to WebSocket.
2. Server subscribes to `event_tx`.
3. Each broadcast item `(event, payload)` is serialized as:
   `{"event":"<event_name>","payload":<json>}`
4. Messages are pushed to all connected clients.

Connection lifecycle:

- Outbound task forwards broadcasts to socket.
- Inbound task listens for close frames.
- `tokio::select!` cancels the peer task when one side terminates.

## Startup Modes

### Desktop app

Standard Tauri run path:

- `codexia_lib::run()`

### Web server mode

Entry point in `main.rs`:

- `codexia --web`
- `codexia web`

This starts only the web server via `codexia_lib::start_web(...)`.

### Frontend + backend development

Use the root `justfile` recipe:

```sh
just dev-web
```

This runs:

- backend web server on `VITE_WEB_PORT` (default `7420`)
- frontend Vite dev server on `1420`

## Testing Strategy

### WebSocket regression test

Unit test location:

- `src-tauri/src/web/websocket.rs`
  - `websocket_route_accepts_connection_and_forwards_events`

What it validates:

1. WebSocket handshake succeeds on `/ws`
2. Broadcasted events are delivered to the client
3. Message envelope shape matches `{ event, payload }`

Run:

```sh
cd src-tauri
cargo test websocket_route_accepts_connection_and_forwards_events --package codexia
```

## Extension Guidelines

- Add new HTTP endpoints in `router.rs` and implement handlers in `handlers.rs`.
- Keep state additions in `WebServerState` explicit and minimal.
- For new push events, publish into `event_tx` and keep payloads JSON-serializable.
- Preserve route naming consistency under `/api/<domain>/<action>`.
