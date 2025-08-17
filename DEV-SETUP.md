# Dev Setup (Isolated)

This project includes scripts to run the Codex CLI and the Tauri dev app in a fully isolated way so your existing Codexia installation and system paths remain untouched.

## Prerequisites
- Node.js (or Bun)
- Rust toolchain (for Tauri backend)
- A valid Codex `auth.json` at `~/.codex/auth.json`

## Install dependencies
- With Bun: `bun install`
- Or with NPM: `npm ci` (or `npm install`)

## Isolated Codex CLI
- Script: `scripts/codex-iso.sh`
- First run copies your `~/.codex/auth.json` to the repo’s isolated home at `.codex-home/.codex/auth.json` (gitignored).
- Usage examples:
  - Version: `./scripts/codex-iso.sh --version`
  - Help: `./scripts/codex-iso.sh --help`
  - Proto mode: `./scripts/codex-iso.sh proto --help`

Notes:
- The script sets `HOME` to `.codex-home/` so the CLI is fully sandboxed.
- Nothing is installed globally; it uses `bunx` if available, otherwise `npx`.

## Isolated Full-App Dev (Tauri + Vite)
- Script: `scripts/tauri-dev-iso.sh`
- Alias command: `codexia-dev` (repo-local launcher)
- NPM/Bun script: `bun run codexia-dev` (or `npm run codexia-dev`)
- What it does:
  - Sets `CODEX_PATH` to the isolated CLI wrapper (`scripts/codex-iso.sh`).
  - Sets `XDG_CONFIG_HOME` and `XDG_DATA_HOME` to temporary directories.
  - Leaves the dev server behavior unchanged (Vite default port `5173`).
  - Overrides Tauri `devUrl` for this run only; no files are modified.

Run it:
- `./codexia-dev`
- Or with scripts: `bun run codexia-dev` (or `npm run codexia-dev`)
- If a port conflict occurs, free 1420 or set another port in vite config temporarily; we avoid overriding devUrl to keep behavior as-is.

Stop it:
- Close the Tauri window, or stop the process in your terminal. If started in the background, `pkill -f '@tauri-apps/cli dev'` is a quick option.

## Verifying the Discovery Fix
- Tail the backend log: `tail -f /tmp/codexia.log`
- Look for entries such as:
  - `Found codex binary at …`
  - `Using wrapper codex … as fallback`

## Troubleshooting
- Missing credentials: ensure `.codex-home/.codex/auth.json` exists; the `codex-iso` script prints a helpful message if not.
- Port in use: set `PORT` as shown above.
- GUI issues (Linux): ensure required libraries for WebView2/WebKitGTK are installed.
