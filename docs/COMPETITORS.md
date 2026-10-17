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

These are consumer products, not B2B: Dots goes to paid ChatGPT users (and
Enterprise with admin activation); Hark Pro has a free tier, no team plan and
an 18+ age limit. They can host a cloud computer per user because they are
heavily funded (Hark raised over $700M at a $6B valuation in May 2026, and
reportedly gave the first 100,000 users free premium). An independent project
cannot copy that hosting model; see [Direction](#direction).

## Open-source self-hosted: Hermes Agent

Nous Research's [Hermes Agent](https://hermes-agent.nousresearch.com) is the
closest open-source reference **(reported)**:

- Self-hosted. Chat gateways (Telegram and others) admit users by a static
  allow-list or by pairing: an unknown user gets a one-time code and the
  owner approves it (`hermes pairing approve <platform> <code>`, or the
  dashboard in third-party Railway deployments).
- Hermes Desktop (public preview, June 2026; macOS, Windows, Linux) has a
  **Bot Mode**, on by default: each profile is a bot with its own
  conversation and Routines (Hermes cron), group chats and @mentions between
  bots. It is the same direction as Codexia's bots.
- The desktop app connects to a backend on another machine (`hermes serve`
  on a VPS or home server, behind an auth provider), over SSH, or to Hermes
  Cloud. So a desktop app plus a remote backend is a working product shape.

Codexia bots have pieces Hermes Bot Mode does not list: a drafts and
hand-backs inbox, and person-required approvals for payment-like tools.

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

## Linux server with phone client

Codexia can run headless on a Linux server and be reached from a phone. This
is for people who are comfortable running a server; it is not the consumer
product shape (see [Direction](#direction)). Setup is in
[SERVER.md](SERVER.md).

Done on `feat/web-musl` **(code)**:

- Static musl `codexia-web` packages (x86_64, aarch64) with the pinned keke
  bundled; install script with systemd and optional Tailscale; Docker image.
- `codexia-web pair` (browser link and QR code) and token sign-in from the
  browser build; `--host` for containers and reverse proxies.
- Telegram gateway: waiting approvals with buttons, drafts, hand-backs and
  finished runs; chat messages become bot turns.

Still missing:

- **Phone push** (APNs or Web Push). Telegram covers this only for people
  who set up a Telegram bot.
- **Sign-in on a server** for MCP OAuth: keke only accepts loopback
  redirects, so a phone cannot finish the browser step.
- Landlock availability on the server kernel is unverified.

## Direction

Decided 2026-10-16:

- **No hosted VMs run by this project.** Ordinary users will not set up
  Tailscale or a Telegram bot, and hosting a cloud computer per user needs
  funding this project does not have.
- **Demo first.** Show the app-first experience on one machine and one user
  (a Mac or one VPS), record it, and use it for a waitlist and for investor
  conversations. The demo script and the status of each step are in
  [DEMO.md](DEMO.md).
- **keke-cloud is the future engine**, in its own repo
  (`milisp/keke-cloud`, not published yet). It is a lean, keke-centred
  backend with an API; Codexia web, the iOS app and chat gateways are its
  clients. Its plan describes hosting options (one-click deploy into the
  user's own account, partners hosting it, or a funded hosted service).
- **Codexia is web-first.** The desktop app stays as a client for people who
  want it; new features go into shared crates and the web API.

Do not claim a vendor cloud, always-on availability independent of the host,
or a hosted service, in any copy.

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
- [Hark releases an AI personal assistant (TechCrunch)](https://techcrunch.com/2026/10/06/hark-releases-an-ai-personal-assistant-with-a-focus-on-privacy/)
- [Hark raises $700M Series A (RuntimeWire)](https://runtimewire.com/article/hark-raises-700m-series-a-brett-adcock)
- [Hark: free premium for the first 100,000 users (KuCoin)](https://www.kucoin.com/news/flash/figure-ai-founder-launches-personal-ai-assistant-hark-offering-free-premium-access-to-first-100k-users)
- [Hermes Agent: team Telegram assistant](https://hermes-agent.nousresearch.com/docs/guides/team-telegram-assistant)
- [Hermes Agent: Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
- [Hermes releases official desktop app (Decrypt)](https://decrypt.co/369952/hermes-ai-agent-official-app-terminal)
