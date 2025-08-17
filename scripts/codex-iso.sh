#!/usr/bin/env bash
set -euo pipefail

# Run Codex CLI in an isolated HOME under this repo.
# Pass-through to the real CLI via bunx (preferred) or npx.

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ISO_HOME="$ROOT_DIR/.codex-home"
ISO_CODEX_DIR="$ISO_HOME/.codex"
DEFAULT_AUTH="$HOME/.codex/auth.json"
ISO_AUTH="$ISO_CODEX_DIR/auth.json"

mkdir -p "$ISO_CODEX_DIR"
chmod 700 "$ISO_CODEX_DIR"

# If no isolated auth yet, copy from default if available.
if [[ ! -f "$ISO_AUTH" ]] && [[ -f "$DEFAULT_AUTH" ]]; then
  cp "$DEFAULT_AUTH" "$ISO_AUTH"
  chmod 600 "$ISO_AUTH"
  echo "[codex-iso] Copied auth.json to isolated home." >&2
fi

if [[ ! -f "$ISO_AUTH" ]]; then
  echo "[codex-iso] Missing auth.json at $ISO_AUTH" >&2
  echo "            Copy your credentials: cp ~/.codex/auth.json $ISO_AUTH" >&2
  exit 1
fi

export HOME="$ISO_HOME"

if command -v bun >/dev/null 2>&1; then
  exec bunx --bun @openai/codex@latest "$@"
else
  exec npx -y @openai/codex@latest "$@"
fi

