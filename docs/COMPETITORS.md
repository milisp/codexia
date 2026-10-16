# Competitors and bot runtime notes

Research notes on hosted personal agents, open-source Dots alternatives, and
what it would take to run a bot on Claude Code. Last checked 2026-10-16.

Facts marked **(code)** were read from source at the stated version. Facts
marked **(reported)** come from launch posts and secondary blogs and may be
wrong or outdated; check the vendor before quoting them.

## Hosted personal agents

| Product | Launched | Runs on | Notable |
| --- | --- | --- | --- |
| OpenAI Dots | 2026-09-29 | Cloud computer with browser, per Dot | 4,000+ apps via plugins; first Dot bundled with Pro ($100+/mo) or Business Premium; not in EEA, Switzerland, UK |
| xAI Grok Bot | Beta 2026-08-11, enterprise October 2026 | Persistent cloud computer (browser, files, terminal) | Learn a routine by watching once; bots coordinate in group chats; desktop and iOS. xAI docs say all bots share one computer and are not a security boundary |
| Meta Muse | 2026-09-08 | VM in Meta's cloud | App and WhatsApp; Sentinel read/write permissions; checkout via Link by Stripe one-time cards; later macOS app control, agent email, realtime avatar, smart glasses |
| Hark Pro | 2026-10-06 | Cloud computer ("Handoff" browser agent) | Web, iOS, Android; proactive alerts; email, calendar, files; asks before sending or paying; free tier, $20 and $100 tiers |

All entries are **(reported)**.

### Where Codexia differs

Gaps, mostly because Codexia has no cloud computer:

- Runs only while Codexia runs on the host; no vendor cloud. A headless
  Linux host closes most of this gap (see below).
- No built-in watchable browser; computer-use is unverified (see
  [BOTS.md](BOTS.md#applications-and-mcp-servers)).
- Connectors are user-configured MCP servers; authentication is not verified.
- Phone access needs remote access over Tailscale, not a native consumer app.
- No teach-by-demonstration, group chats, avatar or voice, or agent email.
- Payment protection is tool-name approval rules, not payment-rail controls
  such as one-time cards.

Strengths to lead with:

- Open source, local-first, uses the user's own subscriptions and models.
- Developer-oriented: project folders, git worktrees, triggers on commits,
  new files, failed CI runs and assigned issues.
- Per-bot memory, client-only MCP selection, and person-required approvals
  enforced by keke (on macOS and Linux; see below).

Do not claim a vendor cloud or availability independent of the host. A
self-hosted Linux server is the always-on path (see below).

## Open-source Dots alternatives

Checked from each repository's default branch on 2026-10-16 **(code)**.

| Project | Runtimes | MCP | Permissions approach |
| --- | --- | --- | --- |
| [Shashankss1205/OpenDots](https://github.com/Shashankss1205/OpenDots) | Claude Code, Codex, APIs, Ollama | No (own tool registry) | CLIs are planners only. Claude: `--tools ''`, `--disallowedTools 'mcp__*'`, `--permission-mode plan`, `--setting-sources ''`, `--strict-mcp-config`, `--json-schema` (`opendots/agents.py`). Codex: `-a never exec --sandbox read-only`. OpenDots executes actions itself under per-action policy `auto/approval/ask/draft/deny` (`opendots/engine.py`). Linux + Bubblewrap required |
| [Anil-matcha/open-dots](https://github.com/Anil-matcha/open-dots) | Claude Code only in backend | No | Chat: `--permission-mode dontAsk --strict-mcp-config`, no tools. With tools: only `Read,Write,Edit,Glob,Grep,Bash`, each call asked over `--permission-prompt-tool stdio` (`backend/app/services/local_claude_runner.py`, `local_claude_stream.py`) |
| [HarnessMD/munder-difflin](https://github.com/HarnessMD/munder-difflin) | Claude Code, Codex, Grok and others | Yes | Approvals off: `--permission-mode bypassPermissions`, `--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`, `--yolo` (`src/shared/*Commands.ts`, `agentProvider.ts`) |

None of them combines a CLI's native agent tools, MCP, and enforced
approvals. Each one gives up at least one of these.

## Claude Code as a bot runtime

### claude-agent-sdk-rs does not need an upgrade

Codexia pins `claude-agent-sdk-rs` v0.8.0 (`Cargo.toml`), the latest tag in
`../claude-agent-sdk-rs`. It already exposes an appended system prompt,
`mcp_servers`, `resume`, `can_use_tool`, `setting_sources`, `sandbox`, `env`,
and `auto` / `dontAsk` permission modes **(code)**. `--strict-mcp-config` has
no typed field but can go through `extra_args`.

The cost is elsewhere: bots are built on `AcpClient` in `crates/acp`
(unattended runs, waiting approvals, inbox, `session/load`, live streaming).
An SDK runtime would duplicate all of it in `crates/cc`.

### Preferred path: claude-agent-acp

`crates/acp/src/agents.rs` already has a `claude` preset (`claude-code-acp`,
then `npx @agentclientprotocol/claude-agent-acp`). Version 0.92.0 **(code)**
passes SDK options through `_meta.claudeCode.options` on `session/new` and
`session/load`, including `strictMcpConfig`, `settingSources`, `systemPrompt`,
`settings`, `sandbox`, `env` and `disallowedTools`. It overrides `cwd`,
`permissionMode` and `canUseTool`, defaults `settingSources` to
`["user", "project", "local"]`, supports `loadSession`, and reports the tool in
`_meta.claudeCode.toolName` (for example `mcp__stripe__create_payment`).

Mapping of keke-specific bot behavior:

| keke today | claude-agent-acp | Difficulty |
| --- | --- | --- |
| `--mcp-policy client-only`, confirmed by `keke.dev/mcp-policy` in initialize | `strictMcpConfig: true` in session `_meta`; not confirmed by the adapter, so pin its version | Medium |
| `KEKE_INSTRUCTIONS` | `_meta.systemPrompt` or `systemPrompt` option (exact shape unverified) | Low |
| `KEKE_MEMORY_DIR` | No equivalent; Claude auto-memory is per cwd, so bots in one project share it. Changing `CLAUDE_CONFIG_DIR` affects login | High |
| `KEKE_REQUIRE_APPROVAL` and `keke.dev/person-required` | Must be matched in Codexia's client against `claudeCode.toolName` | High (see below) |
| `keke.dev/tool` for standing approvals | `claudeCode.toolName` | Low |
| Trust levels | read-only: `plan` or `dontAsk` with `disallowedTools`; Ask: `default`; Autonomous: `auto`; set through `session/set_mode` | Medium |

### The blocker: required approvals

Claude Code calls `canUseTool` only when it would prompt. So:

- In `auto` mode, tools the classifier approves never reach Codexia, and
  `*pay*` rules cannot be enforced.
- Allow rules in `~/.claude/settings.json` skip the prompt whenever
  `settingSources` includes `user`. Bots should pass `settingSources: []`.
- `permissions.ask` rules cannot express substring patterns like `*pay*`.

Until this is solved, a Claude bot should offer only Read-only and Ask, with
`settingSources: []` and `strictMcpConfig: true`, and required approvals
matched in the client. Unverified: whether strict MCP also excludes plugin MCP
servers, and the adapter's HTTP MCP header support needed by `codexia-bots`.

## Platform sandbox status

From `keke-agent/crates/sandbox` **(code)**:

- **macOS**: Seatbelt.
- **Linux**: Landlock for the filesystem and seccomp for the network, run by
  keke's own binary as a launcher. Bubblewrap is avoided on purpose because
  Ubuntu 24.04's default AppArmor profile refuses unprivileged user
  namespaces. Behavior on kernels without Landlock is unverified.
- **Windows**: no sandbox. `lib.rs` succeeds unenforced on platforms without
  one. Decision: bots are hosted on Linux (or macOS); Windows is a client
  only, so this is not a launch blocker. [BOTS.md](BOTS.md#trust-levels)
  should still say the sandbox is enforced on macOS and Linux only.

## Linux cloud host with phone client

Goal: a bot host that is not a desktop app. Codexia runs headless on a Linux
server, and the phone is the main way to talk to bots and approve steps.
This is how Codexia gets closer to "keeps working after you close the
laptop" without a vendor cloud.

Already in the repo **(code)**:

- `codexia-web` headless binary (`web/`). `server_web.rs` starts the
  automation runtime (schedules and triggers) and cleans up orphaned bot
  runs, so bots and routines run without the desktop app.
- Bot API routes in `web/src/router.rs` (`/api/bots/*`, inbox, runs) and the
  `codexia-bots` MCP endpoint.
- `release-web.yml` publishes Linux tarballs (per arch and libc) built by
  `scripts/package-web.sh`.
- Remote access over Tailscale; iOS thin client per
  [ROADMAP-MULTI-CLIENT.md](ROADMAP-MULTI-CLIENT.md).

Missing or unverified:

- **keke is not bundled** in the web package (`scripts/package-web.sh` does
  not mention keke). A server falls back to `keke` on `PATH` or
  `npx @milisp/keke@latest`, which is not the tested version. Ship or pin it.
- **Phone notifications**: no push (APNs, Web Push, ntfy) found. Approvals
  that wait 12 hours need a push to the phone, not a desktop toast.
- **Server install**: no Dockerfile or systemd unit; needs a one-command
  install with restart on failure and an always-on service.
- **Sign-in on a server**: keke provider login, `gh` login and MCP OAuth on a
  machine without a browser.
- **Exposure**: authentication for the API when reachable beyond Tailscale
  (see `web/src/auth.rs`).
- Landlock availability on the server kernel.

## Launch checklist (Product Hunt)

1. Copy: Codexia hosts Codex and Claude Code sessions; bots ("dots") run on
   keke. Say it runs on your own machine or Linux server, with your own
   subscriptions; no claim of a vendor cloud.
2. One-line position, for example: "Open-source Dots on your own Linux
   server: keke bots you reach from your phone, with enforced approvals."
3. Before launch: bundle or pin keke in the Linux package, and add phone push
   for approvals.
4. Demo: trigger on the server, unattended run, payment-like step waits,
   approve from phone.

## Sources

- [OpenAI Dots explained (eesel)](https://www.eesel.ai/blog/openai-dots)
- [OpenAI Dots pricing (eesel)](https://www.eesel.ai/blog/openai-dots-pricing)
- [OpenAI Dots: Always-On Agents With Their Own Computer](https://www.orcarouter.ai/blog/openai-dots-agents-devday-2026)
- [OpenAI Dots introduction](https://openai.com/index/introducing-dots/)
- [xAI Launches Grok Bot (Unite.AI)](https://www.unite.ai/xai-launches-grok-bot-always-on-ai-teammates-with-their-own-cloud-computers/)
- [Grok Bot: AI Teammates Get Their Own Computer](https://www.digitalapplied.com/blog/grok-bot-ai-teammates-launch-cloud-computer-2026)
- [xAI News](https://x.ai/news)
- [Introducing Muse (Meta)](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/)
- [Meta debuts Muse (Axios)](https://www.axios.com/2026/09/08/meta-debuts-muse-personal-ai-agent)
- [Hark on Product Hunt](https://www.producthunt.com/products/hark-3)
- [Hark AI: What Hark Pro Does](https://www.usecarly.com/blog/hark-ai/)
- [Free Open Source dots Arrives as OpenDots](https://pasqualepillitteri.it/en/news/20412/free-open-source-dots-opendots-alternatives)
