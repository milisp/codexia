# Codexia iOS

A thin client for driving a Codexia desktop from your phone over Tailscale.

It is deliberately not a port of the desktop UI: it lists sessions, shows a
transcript, sends prompts, approves tool calls, and interrupts a running turn.
Everything else — terminal, file browser, git — stays on the desktop.

## Build

```bash
brew install xcodegen          # once
cd ios
xcodegen generate
open Codexia.xcodeproj
```

`Codexia.xcodeproj` is generated, not committed. Re-run `xcodegen generate`
after adding files.

## Connecting to a desktop

1. On the desktop, start the server so it accepts tailnet clients:

   ```bash
   codexia-web --remote
   ```

   Without `--remote` it binds to loopback only. `--remote` binds to the
   Tailscale IPv4 specifically — not `0.0.0.0` — so the server is reachable from
   your tailnet and nothing else.

2. Open **Settings → Remote Access** in the desktop UI and copy the Tailscale
   hostname and device token.

3. In the iOS app, tap **+**, and enter them.

The token is generated on first run and stored at `~/.codexia/device-token`
(mode 0600). It grants full access to that machine — treat it like an SSH key.
Delete the file to rotate it; the desktop generates a new one on next start.

Requests originating from the desktop itself skip the token, so the local UI
keeps working with no configuration.

## Regenerating protocol types

`Codexia/Generated/CodexProtocol.swift` is generated from the JSON Schema that
codex ships, covering the ~15 message types this client touches out of ~240.

```bash
scripts/gen-swift-protocol.sh [path-to-codex-rs]
```

Do not hand-edit the generated file. If codex renames or drops a schema the
script fails loudly rather than silently producing a smaller file.

## Notes for future work

- **Sequence numbers are global.** The client subscribes with `agents=codex`, so
  the `seq` values it sees have gaps. Treat `seq` purely as a resume cursor.
- **Claude Code is not wired up.** `AgentKind` already carries a `.cc` case and
  the desktop event stream namespaces both agents, so adding it is a new case
  plus a handful of models — not a reshape.
- **No push notifications.** A turn that finishes while the app is backgrounded
  is only seen when the user returns; the event replay makes sure nothing is
  lost, but nothing alerts them either.
