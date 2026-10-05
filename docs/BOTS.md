# Bots

A bot is a named, long-lived agent with its own project folder, role, model,
permissions, memory and tools. Bots run on the [keke](https://github.com/milisp/keke)
agent. Create them in the sidebar's Bots group and configure them in the bot
settings dialog. For a first-use walkthrough, see [bots_usage.md](bots_usage.md).

## Trust levels

The trust level decides what a bot may do without asking you.

| Level | Approval policy | Sandbox | Behavior |
| --- | --- | --- | --- |
| Read-only | `on-request` | `read_only` | Cannot write. File writes the agent routes through Codexia are refused too. |
| Ask (default) | `on-request` | `workspace_write` | Writes inside its project; asks you before anything risky. |
| Autonomous | `never` | `workspace_write` | Never asks; every permission request is allowed. |

The sandbox mode and approval policy are sent to keke for every session, so
they are enforced by the agent, not just shown in the UI. An unknown level
falls back to Ask.

## Memory

Each bot has its own persistent memory folder, passed to keke as
`KEKE_MEMORY_DIR`:

```
~/.codexia/bots/<bot id>/memory
```

Bots never share memory. To reset a bot's memory, delete that folder.

## Applications and MCP servers

The composer Plus menu selects which MCP servers the bot may use.
Manage opens the existing Plugins → Connectors view with the Bots
target selected. Featured connectors and custom additions use the same view as
Codex and Claude, with separate runtime-owned definitions. The primary definitions belong to keke in `~/.keke/.mcp.json`, not Codex. Disabled or
since-removed servers are skipped. A bot with none selected gets no MCP tools
(other than the separately authorized `codexia-bots` collaboration tools, below).

Application presets help configure integrations; they do not grant credentials
or bypass provider authorization. Local sandbox permissions do not constrain
remote service writes: use account scopes, server tool restrictions and approval
policy as appropriate for each integration.

Codex definitions are an explicit import source, not an implicit fallback. Import
must not overwrite an existing keke server of the same name. Codex OAuth state
is not evidence that a keke server is authenticated. Computer-use servers may
be imported as ordinary MCP definitions when compatible; Codex-specific plugin
discovery and authorization are not transferred automatically.

Selections are stored as `keke:<name>`; legacy bare Codex names are not silently
rebound or deleted. Select/import them explicitly. HTTP/SSE native `headers` and
stdio `env` are forwarded, without copying Codex OAuth state. The original
server name and configured URL are retained so keke can use its own native
authentication identity. Configuration presence does not prove authorization:
verify the connection with keke and the provider before relying on a bot run.

Computer-use launcher, command, arguments and environment must be compatible
with an ordinary stdio MCP server. Adding a definition does not enable desktop
control or grant system permissions. The computer-use handshake and operating
system permissions have not been verified by this integration.

Bots use keke's client-only MCP policy. Only the session's explicitly supplied
MCP servers are installed, using their original names; keke does not install
global, workspace or plugin MCP servers, even if already trusted. Filtering
happens before MCP tools are registered or server processes are started. An
empty selection installs no external MCP servers. The separately authorized
`codexia-bots` server is supplied only when collaboration is enabled, and is
never supplied to a delegated session.

The same rule applies to new and resumed conversations, unattended runs and
keke's built-in subagents. Non-MCP plugin capabilities remain subject to
keke's plugin trust checks. This isolates external MCP selection; it does not
create a process security sandbox or remove built-in agent tools. Trust levels,
operation approvals and provider scopes still apply.

## Routines

A routine (Scheduled task in the UI) is a prompt that runs as the bot on a
schedule. Manage them from the bot chat: create, edit, pause, delete, or run now. Routines reuse
Automations, so they also appear in the Automations view (agent `bot`).

The scheduler is hosted in the running backend and uses the host's local
timezone. It is not a cloud scheduler: stopping the backend stops scheduling.
The host must be awake. There is no application-level missed-run replay
guarantee after shutdown or sleep. A disconnected remote client does not itself
stop the host backend.

## Unattended runs

Routines and bot-to-bot requests run with nobody watching, in a short-lived
process of their own. Permission requests are answered automatically:

- Autonomous bots: everything is allowed.
- Other bots: allowed only for tools you have approved with "Always allow"
  in an earlier chat; everything else is refused.

If any step is refused, the run finishes with status **blocked** instead of
success, so a half-done job is not reported as done. Open the bot, approve the
tool with "Always allow" (or raise the trust level), and run again.

Every unattended run is filed in the bot's conversation with an unread badge. The
sidebar shows a status dot per bot while it works or after it finishes.

## Bot-to-bot help

Authorized bot collaboration uses a built-in MCP server, `codexia-bots`, served by the local API at
`/mcp/bots`, with two tools:

- `list_bots`: id, name and title of allowed, non-archived collaborators.
- `ask_bot`: hand a self-contained request to another bot and wait for its
  answer. The other bot works in its own project, with its own trust level and
  memory, and does not see the asking conversation.

The caller's collaborator allowlist is enforced by the backend, not just the
settings UI. A coordinating bot uses the same mechanism as any other caller;
it has no implicit administrative authority. Review the target's permissions
before authorizing delegation: its tools may be more powerful than the caller's.

The MCP endpoint requires a process-local bearer capability bound to the caller;
the `from` query parameter alone is not authority. Capabilities are issued only
for sessions with delegation enabled, expire after eight hours, and are revoked
when the connection stops, its process exits, or its client is dropped. Existing
and new bots default to an empty collaborator allowlist until explicitly saved.

Help is one hop deep: a bot that was asked by another bot does not get
`codexia-bots`, so bots cannot bounce work back and forth. The request shows
up in the target bot's conversation like a routine run.

## Notifications

When a bot finishes, fails or is blocked in the background you get a
notification, unless you are already looking at that bot. If the window is
focused, it is an in-app toast; otherwise a system notification (falling back
to a toast if permission is denied or you are not on the desktop app).
Notifications can be turned off per bot in its settings.

## keke requirement

Bots require keke's ACP client-only MCP isolation support. Codexia launches
`keke agent stdio --mcp-policy client-only` and requires the initialize response's
`_meta["keke.dev/mcp-policy"]` to equal `"client-only"`. This is a keke extension,
not a standard ACP field. Codexia checks this confirmation rather than assuming
support from a version number. A runtime that rejects the isolation launch
option or does not confirm the active policy cannot start a bot; there is no
fallback to global MCP discovery. This applies to interactive bots, scheduled
runs and delegated runs, including their resumed conversations. Ordinary non-bot ACP sessions retain
their existing MCP behavior.

Codexia looks for keke in this order:

1. the `keke` binary bundled with Codexia release builds (the version this
   Codexia was tested with, so an older keke on `PATH` cannot get in the way)
2. your own `keke` on `PATH` (used when running Codexia from source)
3. `npx @milisp/keke`

Release builds ship keke as a sidecar, so no separate install is needed. If
keke cannot be started, the bot interface shows an Install keke button. If the
runtime lacks isolation support, update the runtime actually selected above;
an older bundled binary is not replaced by a newer binary on `PATH`.
