# Using bots

A bot is a named assistant with its own role, workspace, model, memory and
tools. Use an ordinary Agent session for a one-off coding conversation; use a
bot when you want to return to the same assistant or schedule recurring work.

## Start with one useful task

1. Open **Bots** in the sidebar and create a bot.
2. Give it a recognizable name and a specific role, such as "Project reviewer".
3. Choose its project folder and a working model/provider.
4. Keep **Ask** as the initial trust level.
5. Send a small request first:

   > Read this project's README and summarize how to run its tests. Do not change files.

Clicking a bot opens its continuous conversation. Earlier messages and scheduled
results appear in the same timeline; runtime sessions are managed automatically.

## Connect applications and tools

Open the bot's settings and find **Apps and tools**. **Save & manage tools** opens
**Plugins → Connectors** with **Bots** selected as the configuration target.
Add a featured connector or use the + action for a custom local or remote MCP
server. Manage configured servers, JSON definitions and Codex imports from the
management action. Return to the bot's settings to select which tools it may use.
Saving stops an idle bot runtime so its next task uses the updated configuration.
The primary configuration is `~/.keke/.mcp.json`; Codex and Claude configurations
remain separate.

Adding the GitHub or Slack preset adds a server definition, not a working account
connection. Codex OAuth credentials are not reused. Configured local stdio
servers can use their configured environment; HTTP/SSE servers receive their
configured headers. keke retains the original server name and URL for its own
native authentication. Verify provider authorization with a real connection;
a saved definition does not show that authentication succeeded.

Use the explicit Codex import action only for definitions you want to copy to
keke. Existing names are not overwritten. Review legacy selections rather than
assuming that a same-named keke server is the old Codex server. Compatible
computer-use MCP definitions can be copied this way, but Codex-specific plugin
discovery and authorization do not transfer with the definition. A computer-use
definition does not grant desktop access or system permissions. Its handshake
and operating-system permissions have not been verified by this integration.

Bots require strict MCP isolation. Only selected external MCP servers are
installed, using their original names, plus separately authorized bot
collaboration. Global, workspace and plugin MCP servers are excluded even if
trusted. No selection means no external MCP servers. This also applies to
resumed chats, scheduled tasks, delegated runs and built-in subagents. A keke
runtime that does not confirm isolation cannot start a bot.

This controls external MCP selection; built-in agent tools and sandbox,
approval and provider permissions remain relevant. Legacy bare server
selections are retained and require explicit reselection as keke tools; they
are not silently switched to a same-named server or removed.

- **GitHub:** connect with credentials that have access only to the repositories
  you need. Start with read-only access where supported. Test with a request to
  list or summarize issues before permitting changes.
- **Slack:** an official connection requires an appropriately configured Slack
  application and authorization. A preset is not a substitute for installing
  and authorizing that application in your workspace.

Only select tools the bot actually needs. Account scopes and server-side tool
restrictions matter: a read-only local filesystem sandbox does **not**, by
itself, make remote GitHub or Slack operations read-only. Do not put tokens in
chat messages or task prompts. Revoking a connection can cause scheduled tasks
that use it to fail.

## Schedule a task

A scheduled task sends a saved prompt to this bot at specified times. It is not
a recorded workflow and does not automatically learn actions from your screen.

1. First run the intended request manually and check the result.
2. Open **Scheduled tasks** from the bot's chat.
3. Give the task a name, write a self-contained request, and choose its schedule.
4. Check the host's local timezone; scheduling uses the backend machine's time.
5. Use **Run now** to test without waiting for the scheduled time.
6. Find the result in the bot conversation and check its outcome.

Example task:

> Summarize the current git status and recent commits in this project. Highlight
> changes that may need review. Do not edit files, commit, or push.

For a task using GitHub or Slack, explicitly include the repository or channel
and the expected output. Reading a channel and posting to it require different
permissions; test reading before enabling posting.

### The host must be running

The scheduler runs inside the Codexia backend, not in a hosted cloud service.
The desktop application or standalone backend must remain running, and the
host must be awake and have any required network access. Closing the backend
stops execution. There is no application-level guarantee that missed schedules
are replayed after shutdown or sleep; inspect results and run manually if needed.
Disconnecting a phone is different from stopping its desktop backend.

### Background approvals

Scheduled tasks run without an interactive approval dialog. Autonomous bots
allow permission requests; other bots allow only tools previously approved with
**Always allow**. Otherwise the task is marked **blocked**, not successful.

Review the requested operation in an interactive chat, approve only the needed
tool if appropriate, and retry. Do not switch to Autonomous merely to dismiss
an error: that setting gives unattended runs much broader authority.

## Ask another bot for help

In the asking bot's collaboration settings, select the bots it is allowed to
call. Keep specialists narrowly scoped. For example, authorize your coordinating
assistant to ask your reviewer, then send:

> Ask Project reviewer to examine the latest changes in its workspace without
> editing files. Summarize its findings and identify which findings came from it.

The receiving bot uses its own workspace, tools, permissions and memory. It does
not receive the complete conversation, so include all necessary context in the
request. Delegation is one hop: the receiving bot cannot delegate again during
that request. A coordinating bot is not an administrator and does not gain the
right to change another bot's permissions.

## Notifications and results

Use the bell beside **Bots** to find unread background activity. Open the bot
and its conversation to inspect the actual result rather than treating a completion
notification as proof that the answer is correct.

- **Working:** execution is in progress.
- **Blocked:** a required operation lacked approval.
- **Failed:** execution encountered an error; inspect the result and connection.
- **Done:** execution finished; review the output.

Per-bot notification settings control alerts. The focused application uses
toasts; desktop system notifications require operating-system permission.

## Troubleshooting

- **No tools listed:** configure an application/MCP server, then authorize it
  for this bot. A saved server name does not prove its connection is healthy.
- **No scheduled result:** check that the backend was running, the host was
  awake, the task was not paused, and the schedule matches the host timezone.
- **Blocked:** check tool approvals; retry only after reviewing the operation.
- **Cannot ask a colleague:** check the calling bot's allowed collaborators and
  whether the target is archived.
- **Bot cannot start:** check the keke installation prompt and model/provider
  configuration. Release builds include keke; source development may use PATH
  or the documented fallback. Bots require confirmed ACP client-only MCP
  isolation support. An older runtime fails explicitly; update the bundled,
  PATH or `npx @milisp/keke` runtime actually in use. Codexia does not infer
  support from a version number or retry without isolation.

For architecture and enforcement details, see [BOTS.md](BOTS.md).
