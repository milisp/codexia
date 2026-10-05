# AGENTS.md

## Project Info
- Agent os for `codex cli` and `claude code cli` - agent
- use `codex app-server` and `claude-agent-sdk-rs` to connect Codexia

### Project tech
- Package manager: bun
- Framework: React + shadcn + tailwindcss + TypeScript + Tauri v2
- Don't use emit_all
- UI: use shadcn UI components first, Button, Input, etc.
- code comment language: English-only
- Zustand: for state management with persistence
- Don't break Fast Refresh: a `.tsx` file rendering UI must only export PascalCase components (no lowercase JSX-returning helpers), otherwise HMR falls back to a full page reload and drops in-flight events

## Common Commands
- `bun tauri dev` - read the backend output
- `bunx tsc --noEmit` - test frontend if frontend change
- `bun run test` - run frontend Vitest tests when frontend code or tests change
- `bunx react-doctor@latest --no-telemetry --scope changed` - fix frontend if frontend change
- `bunx --bun shadcn@latest add <dep>` - add shadcn dep
- `cargo check -p codexia` if rust code change
- only `cargo build` when I ask
- Don't run `cargo fmt`

## Rust Validation
- Run local validation when Rust code, Cargo manifests, or Cargo.lock change; do not rely on CI to catch compilation errors, clippy warnings, or failing tests.
- For an isolated crate change, run `cargo clippy -p <package> --all-targets --locked -- -D warnings` and `cargo test -p <package> --locked`. Include affected dependent packages when relevant.
- For shared crates, cross-crate changes, or workspace dependency changes, run the same checks as CI: `cargo clippy --workspace --all-targets --locked -- -D warnings` and `cargo test --workspace --locked`.
- Tauri context generation requires the frontend dist directory. If it is missing, run `mkdir -p dist` for Rust-only validation; use a real frontend build when validating embedded assets.
- Pure frontend, documentation, or workflow-only changes do not require Rust validation unless they affect Rust compilation or test behavior.
- Report any checks that could not run and why. Do not suppress warnings or skip failing tests just to pass validation.
- Clippy and tests compile code as needed; the restriction on `cargo build` does not prohibit these validation commands. Local checks do not replace CI's Linux/platform-specific checks.

## Frontend Tests
- Keep regression tests with the component or hook that owns the behavior. When behavior moves, migrate the tests and update their mocks and interactions.
- Do not delete or skip a failing test just to make CI pass. Remove obsolete assertions only when the behavior is intentionally removed; preserve coverage when the behavior still exists.
- Prefer accessible queries such as `getByRole('button', { name: ... })` for UI interactions.

## Project Structure
codexia/
├── src/                    # React frontend source
│   ├── components/         # UI components
│   ├── components/ui/` - shadcn UI components
│   ├── components/cc/` - claude-code components
│   ├── components/codex/` - codex components
│   ├── views/              # View components
│   ├── hooks/              # Custom React hooks
│   ├── store/              # Zustand state management
│   ├── services/           # Business logic services
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Rust backend source
│   ├── src/
│   │   ├── lib.rs          # Main Tauri application
│   ├── capabilities/       # Tauri capabilities
│   └── Cargo.toml          # Rust dependencies
├── Cargo.toml              # Workspace root Cargo.toml
├── crates/
│   ├── codex/              # Codex crate
│   ├── cc/                 # Claude Code crate
│   ├── db/                 # Database crate
│   └── shared/             # Shared crate
- use `@/hooks` `@/types` etc.

## Skill
- when remove a key from zustand persist store, you must update store version and migrate

## docs
- docs/ROADMAP-MULTI-CLIENT.md

## web server

- new tauri command add a api to `web/src/handlers/` 
- invoke add to `src/services/tauri/`

## tailscale for remote control

- ios connect to desktop

## cwd
cwd mean current working dir
