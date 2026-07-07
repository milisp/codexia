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

## Common Commands
- `bun tauri dev` - read the backend output
- `bunx tsc --noEmit` - test frontend if frontend change
- `bunx react-doctor@latest --no-telemetry --category Bugs` - fix frontend if frontend change
- `bunx --bun shadcn@latest add <dep>` - add shadcn dep
- `cargo check -p codexia` if rust code change
- only `cargo build` when I ask
- Don't run `cargo fmt`

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

## p2p stun for remote control

- ios connect to desktop

## cwd
cwd mean current working dir
