#!/usr/bin/env bash
set -euo pipefail

# Launch Tauri dev with isolated config/data dirs and the isolated Codex CLI.
# - Leaves production Codexia untouched.
# - Keeps dev server behavior unchanged (uses the app's configured devUrl).

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ORIG_HOME="$HOME"

# Use isolated Codex CLI wrapper in this repo
export CODEX_PATH="$ROOT_DIR/scripts/codex-iso.sh"

# Isolate app config/data from your main system install
export XDG_CONFIG_HOME="$(mktemp -d)"
export XDG_DATA_HOME="$(mktemp -d)"

# Use isolated HOME under the repo so dev config/auth are sandboxed
export HOME="$ROOT_DIR/.codex-home"
# Preserve Rust toolchain paths so cargo/rustup work even with isolated HOME
export CARGO_HOME="${CARGO_HOME:-$ORIG_HOME/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$ORIG_HOME/.rustup}"
mkdir -p "$HOME/.codex"

# Ensure dev-specific ~/.codex/config.toml has NO mcp_servers (they cause issues in dev)
DEV_CFG="$HOME/.codex/config.toml"
if [[ -f "$DEV_CFG" ]]; then
  # Filter out any [mcp_servers] and [mcp_servers.*] sections
  TMP_CFG="$(mktemp)"
  awk '
    /^\[/ {
      if ($0 ~ /^\[mcp_servers/) { skip=1; next } else { skip=0; print; next }
    }
    { if (skip==0) print }
  ' "$DEV_CFG" > "$TMP_CFG"
  mv "$TMP_CFG" "$DEV_CFG"
else
  # Create minimal config with empty projects
  cat > "$DEV_CFG" << 'EOF'
# Dev isolated Codex config (no MCP servers)
[projects]
EOF
fi

echo "[tauri-dev-iso] Using HOME=$HOME"
echo "[tauri-dev-iso] CARGO_HOME=$CARGO_HOME"
echo "[tauri-dev-iso] RUSTUP_HOME=$RUSTUP_HOME"
echo "[tauri-dev-iso] Dev config at $DEV_CFG with MCP servers removed"

echo "[tauri-dev-iso] Using CODEX_PATH=$CODEX_PATH"
echo "[tauri-dev-iso] XDG_CONFIG_HOME=$XDG_CONFIG_HOME"
echo "[tauri-dev-iso] XDG_DATA_HOME=$XDG_DATA_HOME"
echo "[tauri-dev-iso] Using project dev server settings (no override)"

# Force reasoning visibility like CLI during dev runs
export CODEX_FORCE_REASONING=1

if command -v bun >/dev/null 2>&1; then
  exec bunx --bun @tauri-apps/cli dev "$@"
else
  exec npx -y @tauri-apps/cli dev "$@"
fi
