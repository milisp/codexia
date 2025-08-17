#!/usr/bin/env bash
set -euo pipefail

# Launch Tauri dev with isolated config/data dirs and the isolated Codex CLI.
# - Leaves production Codexia untouched.
# - Keeps dev server behavior unchanged (uses the app's configured devUrl).

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Use isolated Codex CLI wrapper in this repo
export CODEX_PATH="$ROOT_DIR/scripts/codex-iso.sh"

# Isolate app config/data from your main system install
export XDG_CONFIG_HOME="$(mktemp -d)"
export XDG_DATA_HOME="$(mktemp -d)"

echo "[tauri-dev-iso] Using CODEX_PATH=$CODEX_PATH"
echo "[tauri-dev-iso] XDG_CONFIG_HOME=$XDG_CONFIG_HOME"
echo "[tauri-dev-iso] XDG_DATA_HOME=$XDG_DATA_HOME"
echo "[tauri-dev-iso] Using project dev server settings (no override)"

if command -v bun >/dev/null 2>&1; then
  exec bunx --bun @tauri-apps/cli dev "$@"
else
  exec npx -y @tauri-apps/cli dev "$@"
fi
