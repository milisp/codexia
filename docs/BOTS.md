# Bots

A bot is a named, long-lived agent with its own project folder, role, model,
permissions, memory and tools. Bots run on the [keke](https://github.com/milisp/keke)
agent. Create and configure them in the Bot tab (bot settings dialog).

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

## MCP servers

In bot settings, pick which MCP servers the bot may use. The list comes from
the MCP servers configured for Codex (Plugins > Connectors). Disabled or
since-removed servers are skipped. A bot with none selected gets no MCP tools
(other than `codexia-bots`, below).

## Routines

A routine is a prompt that runs as the bot on a schedule. Manage them in the
bot's settings: create, edit, pause, delete, or run now. Routines reuse
Automations, so they also appear in the Automations view (agent `bot`).

## Unattended runs

Routines and bot-to-bot requests run with nobody watching, in a short-lived
process of their own. Permission requests are answered automatically:

- Autonomous bots: everything is allowed.
- Other bots: allowed only for tools you have approved with "Always allow"
  in an earlier chat; everything else is refused.

If any step is refused, the run finishes with status **blocked** instead of
success, so a half-done job is not reported as done. Open the bot, approve the
tool with "Always allow" (or raise the trust level), and run again.

Every unattended run is filed in the bot's history with an unread badge. The
sidebar shows a status dot per bot while it works or after it finishes.

## Bot-to-bot help

Bots get a built-in MCP server, `codexia-bots`, served by the local API at
`/mcp/bots`, with two tools:

- `list_bots`: id, name and title of the other (non-archived) bots.
- `ask_bot`: hand a self-contained request to another bot and wait for its
  answer. The other bot works in its own project, with its own trust level and
  memory, and does not see the asking conversation.

Help is one hop deep: a bot that was asked by another bot does not get
`codexia-bots`, so bots cannot bounce work back and forth. The request shows
up in the target bot's history like a routine run.

## Notifications

When a bot finishes, fails or is blocked in the background you get a
notification, unless you are already looking at that bot. If the window is
focused, it is an in-app toast; otherwise a system notification (falling back
to a toast if permission is denied or you are not on the desktop app).
Notifications can be turned off per bot in its settings.

## keke requirement

Bots need `keke` **0.1.32 or newer** (older versions reject MCP tool names
containing `:`). Codexia looks for it in this order:

1. the `keke` binary bundled with Codexia release builds (the version this
   Codexia was tested with, so an older keke on `PATH` cannot get in the way)
2. your own `keke` on `PATH` (used when running Codexia from source)
3. `npx @milisp/keke`

Release builds ship keke as a sidecar, so no separate install is needed. If
keke cannot be started, the Bot tab shows an Install keke button.
