# Bots

A bot is a named, long-lived agent with its own project folder, role, model,
permissions, memory and tools. Bots run on the [keke](https://github.com/milisp/keke)
agent. Create them in the sidebar's Bots group and configure them in the bot
settings dialog. For a first-use walkthrough, see [bots_usage.md](bots_usage.md).

## Starting from a role

**New bot** opens a picker: a blank bot, or one of the roles grouped as
Engineering, Briefs, Inbox and calendar, Operations and Personal. A role
fills in the name, look, role prompt, trust level and tools, and adds its
routine (shown on the card, e.g. "Weekdays 09:00"). Each card says:

- **What it needs**: the project folder, a keke MCP server (GitHub, Gmail,
  Calendar, Drive or Sheets), or web search. A configured server whose name
  matches shows a check and is selected for the bot; a missing one shows
  **Connect …**, which opens Plugins. Web search is turned on in keke's own
  config (`[providers.<name>.web_search]`) and is not checked here; on a
  Grok subscription login it currently returns no results.
- **Where it stops**: a report, a draft, or an action that asks you. Every
  role's prompt tells the bot to use `propose_draft` and `hand_back`.

Everything a role sets can be changed afterwards in the bot's settings and
scheduled tasks. The roles are in `src/components/bot/botTemplates.ts`.

## Today

With no bot open, the Bot tab shows **Today** (also the first row of the bot
list). It holds only what is new or needs you:

- **Needs you**: bots whose unattended run is waiting for an approval, with
  the Allow/Deny buttons inline.
- **Done since you looked**: one line per unattended run that finished after
  you last opened its bot: the trigger, the start of the reply, and a
  Blocked/Failed badge when it did not finish cleanly. Opening a row, or
  **Mark all seen**, clears it.
- **Coming up**: the next five scheduled runs. They happen only while
  Codexia is running on this computer.

Runs are recorded in `~/.codexia/cache.db` (`bot_runs`); a run that was still
open when the app quit is shown as failed.

## Drafts and hand-backs

Every bot gets two Codexia tools that leave something for you instead of
acting:

- `propose_draft(title, body, action?)`: for anything that would leave the
  computer on your behalf (an email reply, a message, a post, a comment). The
  draft shows in Today and above the bot's composer. You can edit it, then
  **Send**, which continues the conversation the draft came from with your
  final text and asks the bot to carry out `action`. Send is not a direct
  call: the bot's tool calls still go through its trust level and approval
  rules, and payments still always ask. A draft without an `action` can only
  be copied or discarded.
- `hand_back(title, steps, url?)`: for a step only you can do (signing in, a
  password or one-time code, a CAPTCHA, approving in another app). The bot
  ends its turn; you do the step yourself, optionally leave a note (never a
  password), and press **Done** to continue the conversation, or **Dismiss**.
  Codexia never sees or stores the secret.

Both tools are allowed without a prompt at every trust level, because they
only store an item for you. Send and Done run unattended in the stored
session (keke `session/load`); if a bot window still has that conversation
open, its process is stopped first, so two processes never write to one
session, and your next message starts a fresh one.

Items are stored in `~/.codexia/cache.db` (`bot_inbox`). Whether a bot uses
these tools depends on the model following the instructions; nothing stops a
bot with an email tool and the right trust level from sending directly, so
keep such tools behind "Ask" if you want every send reviewed.

## Trust levels

The trust level decides what a bot may do without asking you.

| Level | Approval policy | Sandbox | Behavior |
| --- | --- | --- | --- |
| Read-only | `on-request` | `read_only` | Cannot write. File writes the agent routes through Codexia are refused too. |
| Ask (default) | `on-request` | `workspace_write` | Writes inside its project; asks you before anything risky. |
| Autonomous | `auto` | `workspace_write` | keke's model-backed reviewer answers ordinary requests; a failed or unclear review refuses the step. |

The sandbox mode and approval policy are sent to keke for every session, so
they are enforced by the agent, not just shown in the UI. An unknown level
falls back to Ask. Autonomous uses keke's `auto`, not `never`: `never` would
authorize every step, sandbox escapes included, without any review. The
reviewer is a model and can be wrong or misled; it is a check, not a guarantee.

## Steps only you can approve

Some steps need your answer every time, at every trust level, whether or not
anyone is watching. Codexia hands keke these tool-name rules
(`KEKE_REQUIRE_APPROVAL`) for every bot:

```
*pay*  *purchase*  *checkout*  *buy*  *refund*  *transfer*  *subscri*  acp:*:*delete*
```

They match keke's tool ids case-insensitively, for example
`acp:stripe:create_payment`. A matching step:

- is never answered by "Always allow", by the Autonomous reviewer, or by a
  standing approval, and offers no "Always allow" button;
- in a scheduled or delegated run, waits for you (see below) instead of running.

Rules match tool names, not effects. A payment made through a shell command, a
browser click or a tool with an unrelated name is not recognized. Use provider
account scopes and spending limits as well.

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
A disconnected remote client does not itself stop the host backend.

### Sleep

- **During a run** Codexia keeps the computer from idle-sleeping (interactive
  bot turns and unattended runs alike), and releases it when the run ends or
  while it waits for you. The display may still sleep. Closing a laptop lid
  or choosing Sleep still sleeps the computer.
- **Between runs** the computer sleeps according to your system settings. A
  routine that comes due while it sleeps runs **once** when it wakes, if
  Codexia is still running: several missed times are not each replayed.
- **After Codexia restarts** routines missed while it was closed are not run;
  the next scheduled time is used.

For a bot host that should run around the clock (a Mac mini, say), turn off
automatic sleep in the system settings and keep Codexia running.

## Unattended runs

Routines and bot-to-bot requests run with nobody watching, in a short-lived
process of their own. A permission request is answered from standing approvals
when it can be:

- Autonomous bots: keke's reviewer decides ordinary steps itself.
- Other bots: tools you approved with "Always allow" go ahead. "Always allow"
  is remembered per tool (keke's tool id in `_meta["keke.dev/tool"]`, keke
  0.1.45 or later, such as `acp:shop:lookup_price`), never for ACP's `other`
  kind, which every MCP tool shares. With an older keke the key falls back to
  the request title.

Anything else, including every step only you can approve, **waits for you**.
The bot shows **Needs approval** in the sidebar and the bell, you get a
notification, and the step appears above the bot's composer with Allow and
Deny. Answer it from the desktop or from a phone connected over remote
access; the run then continues where it stopped. While a step waits:

- the run's one-hour work limit is paused;
- the computer is allowed to sleep, since nothing is running;
- the step waits at most 12 hours, then it is refused.

If you deny a step, or it is refused after 12 hours, the run finishes with
status **blocked** instead of success, so a half-done job is not reported as
done. A waiting step lives in the running backend: quitting Codexia refuses
it.

Every unattended run is filed in the bot's conversation with an unread badge. The
sidebar shows a status dot per bot while it works or after it finishes.

## One conversation per bot

A bot has one continuous conversation, like Grok Bot and Dots: chat turns,
scheduled runs and requests from other bots all appear in it, oldest first.
A run nobody typed starts with a marker (**Scheduled · name** or **Asked by
bot**) that expands to the request it ran on, not with a message from you. A
run in progress streams into the conversation live, on every connected client,
including one that opened it mid-run.

Underneath, each scheduled or delegated run is a fresh keke session, so one
long-running bot does not grow an unbounded context. What carries over between
runs is the bot's memory folder. Opening a bot resumes its latest session, so
you can reply to a routine's result directly.

## Bot-to-bot help

Authorized bot collaboration uses the built-in MCP server `codexia-bots`, served by the local API at
`/mcp/bots`, with two tools besides drafts and hand-backs:

- `list_bots`: id, name and title of allowed, non-archived collaborators.
- `ask_bot`: hand a self-contained request to another bot and wait for its
  answer. The other bot works in its own project, with its own trust level and
  memory, and does not see the asking conversation.

The caller's collaborator allowlist is enforced by the backend, not just the
settings UI. A coordinating bot uses the same mechanism as any other caller;
it has no implicit administrative authority. Review the target's permissions
before authorizing delegation: its tools may be more powerful than the caller's.

The MCP endpoint requires a process-local bearer capability bound to the caller;
the `from` query parameter alone is not authority. Capabilities are issued
per session (each one says whether it may ask other bots and which session it
belongs to), expire after eight hours, and are revoked
when the connection stops, its process exits, or its client is dropped. Existing
and new bots default to an empty collaborator allowlist until explicitly saved.

Help is one hop deep: a bot that was asked by another bot gets `codexia-bots`
without `list_bots` and `ask_bot` (its capability does not allow asking), so
bots cannot bounce work back and forth. The request shows
up in the target bot's conversation like a routine run.

## Notifications

When a bot finishes, fails or is blocked in the background you get a
notification, unless you are already looking at that bot. If the window is
focused, it is an in-app toast; otherwise a system notification (falling back
to a toast if permission is denied or you are not on the desktop app).
Notifications can be turned off per bot in its settings.

## keke requirement

Bots require keke's ACP client-only MCP isolation and `require_approval`
support (keke 0.1.44 or later). Codexia launches
`keke agent stdio --mcp-policy client-only` and requires the initialize response's
`_meta["keke.dev/mcp-policy"]` to equal `"client-only"` and
`_meta["keke.dev/require-approval"]` to be `true`. These are keke extensions,
not standard ACP fields. keke marks a request only a person may answer with
`_meta["keke.dev/person-required"]`. Codexia checks this confirmation rather than assuming
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
