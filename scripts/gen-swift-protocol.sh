#!/usr/bin/env bash
#
# Generates Swift Codable types for the subset of the codex app-server protocol
# the mobile client speaks.
#
# The protocol ships JSON Schema upstream, so these types are generated rather
# than hand-written — regenerate after bumping codex instead of patching the
# output by hand. Only the schemas listed in SCHEMAS below are generated: the
# full v2 protocol is ~240 types, and a thin client touches a fraction of them.
#
# Usage:
#   scripts/gen-swift-protocol.sh [path-to-codex-rs]
#
# Note: --protocol equatable is deliberately not passed. Many protocol types
# embed free-form JSON, which quicktype emits as JSONAny; Swift cannot
# synthesize Equatable for those, and the generated file fails to compile.
#
# Requires: quicktype (npm i -g quicktype / bunx quicktype)

set -euo pipefail

CODEX_RS="${1:-${CODEX_RS:-$HOME/projects/rustapp/codex/codex-rs}}"
SCHEMA_DIR="$CODEX_RS/app-server-protocol/schema/json/v2"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/ios/Codexia/Generated"

# Schemas the mobile client decodes or encodes. Keep this list minimal —
# every addition is Swift code that has to keep compiling across codex bumps.
SCHEMAS=(
  # Thread lifecycle and listing
  ThreadListParams
  ThreadListResponse
  ThreadStartParams
  ThreadResumeParams
  ThreadStatusChangedNotification
  ThreadTokenUsageUpdatedNotification

  # Turn lifecycle
  TurnStartParams
  TurnStartedNotification
  TurnCompletedNotification
  TurnInterruptParams

  # Streaming message content
  AgentMessageDeltaNotification
  ItemStartedNotification
  ItemCompletedNotification
  ReasoningSummaryTextDeltaNotification

  # Errors surfaced to the user
  ErrorNotification
)

if [ ! -d "$SCHEMA_DIR" ]; then
  echo "error: schema directory not found: $SCHEMA_DIR" >&2
  echo "pass the codex-rs checkout as the first argument" >&2
  exit 1
fi

if ! command -v quicktype >/dev/null 2>&1; then
  QUICKTYPE="bunx --bun quicktype"
else
  QUICKTYPE="quicktype"
fi

mkdir -p "$OUT_DIR"

missing=()
src_args=()
for name in "${SCHEMAS[@]}"; do
  path="$SCHEMA_DIR/$name.json"
  if [ ! -f "$path" ]; then
    missing+=("$name")
    continue
  fi
  src_args+=(--src "$path")
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "error: these schemas no longer exist upstream: ${missing[*]}" >&2
  echo "the codex protocol changed — update SCHEMAS in this script" >&2
  exit 1
fi

echo "Generating Swift types for ${#SCHEMAS[@]} schemas..."
$QUICKTYPE \
  --src-lang schema \
  --lang swift \
  --struct-or-class struct \
  --access-level public \
  --density dense \
  "${src_args[@]}" \
  -o "$OUT_DIR/CodexProtocol.swift"

echo "Wrote $OUT_DIR/CodexProtocol.swift"
echo
echo "Note: sequence numbers on the event stream are global. A client filtering"
echo "with ?agents=codex will see gaps and must treat seq purely as a cursor."
