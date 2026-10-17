# Demo script

A short video of the app-first experience, for a waitlist page and investor
conversations. It runs on **one machine and one user**; nothing here needs a
hosted service. See [COMPETITORS.md](COMPETITORS.md#direction) for why.

Status per step:

- **in code**: the feature exists in this repo; not yet run end to end for
  the demo.
- **verify**: exists but has an unknown that must be checked before
  recording.
- **missing**: has to be built, or the step is cut.

Nothing here has been rehearsed yet. Update the status as each step is run.

## Story (about 60 seconds)

"Your agents work while you live your life. They ask before anything
leaves your hands."

| # | Viewer sees | Powered by | Status |
|---|---|---|---|
| 1 | Pick **Daily Brief** and **Inbox Triage** from the role picker; each comes with its routine | Role templates (`src/components/bot/botTemplates.ts`), routines | in code |
| 2 | Morning: the phone shows **Today** with the brief, five linked items | Daily Brief routine (08:00), keke web search, Today view | verify |
| 3 | A reply drafted by Inbox Triage; edit one sentence on the phone, **Send** | `propose_draft`, inbox Send continues the session, Gmail connector | verify |
| 4 | Subscription Review lists charges and hands back "Cancel StreamCo" with steps; tap **Done** | `hand_back` | in code |
| 5 | A step that would pay or delete waits; **Allow** on the phone | `KEKE_REQUIRE_APPROVAL` (`*pay*`, `*subscri*`, `*delete*` ...), waiting approvals | verify |
| 6 | Evening: Today shows **Done since you looked** | Bot runs (`bot_runs`), Today | in code |

Close on the line "Open source. Uses the ChatGPT or Grok subscription you
already have." and the waitlist link.

## Setup

- **Host: a Mac**, not a Linux server. On a server the Gmail connector
  cannot be signed in yet (keke's MCP OAuth only accepts loopback
  redirects). Keep the Mac awake and on power while routines are due:
  routines run only while Codexia runs, and a sleeping Mac runs nothing.
- **Model: ChatGPT (`keke login codex`).** Web search on a Grok
  subscription login currently returns no results (see
  [BOTS.md](BOTS.md#starting-from-a-role)), which would empty step 2.
- **Accounts: a demo Gmail account** with seeded mail (a question that needs
  a reply, two subscription receipts). Never record a real inbox.
- **Phone: the Codexia iOS app** connected to the Mac. It reaches the Mac
  over Tailscale (`*.ts.net`); keep that out of the shot. The story is about
  the app, not the network.

## Unknowns to check before recording

1. **iOS app shows the bot views.** Today, the inbox (Send, Done) and
   waiting approvals render and work on a phone-width screen. Check in the
   simulator first with `axe`, then on a device.
2. **Gmail connector signs in through keke on the Mac**, and Inbox Triage
   calls `propose_draft` instead of sending. Whether the model follows the
   instruction is not guaranteed; rehearse it several times.
3. **Send performs the action**: after Send, the reply is actually sent in
   the original thread, with the step going through the bot's trust level.
4. **Step 5 needs a real tool whose name matches a rule.** No payment
   connector is set up today. Options: Stripe's MCP server in test mode, or
   cut step 5 and let step 4 carry the "asks before acting" message. Do not
   fake a tool for the video.
5. **Routines fire on time** with the app open on the Mac, and step 6 lists
   both runs.

## First-use test, 2026-10-17

Run on `feat/web-musl` (`codexia-web` release build) with `HOME` pointed at
an empty folder, a new browser origin, a phone-width window (598 px), no
codex, keke 0.1.45 copied in, and the ChatGPT login copied from the
maintainer's `~/.keke`. Gmail and payment steps were not tested.

What a new user hits, in order:

| # | Step | Result | Cause |
|---|---|---|---|
| 1 | Open the app | A coding composer with **Codex** selected, though codex is not installed; nothing points to bots. Console and server log a `codex backend is not available` error every 4 s | Coding workspace is the default view |
| 2 | Find bots | Sidebar → Bots → "Create your first bot" → role picker. Engineering roles come first; Daily Brief is under Briefs | Template order |
| 3 | Pick Daily Brief | Bot and its 08:00 routine are created, then the full settings dialog opens (workspace `/path/to/project`, model note, long persona) | Picker opens settings |
| 4 | Reload with one bot | Main view shows **"Create your first bot"** indefinitely; it switches to Today only after the sidebar is opened | `BotChatView` reads `bots` from `useBotUiStore`, which only sidebar components (`SideBarBotPane`, `BotNotifications`) load; on a phone the sidebar is closed |
| 5 | Open the bot | "Daily Brief runs on the keke agent, which isn't installed yet. **Install keke**", although keke was on `PATH` | The bot's `cwd` is `""` (no project folder), so spawning keke fails with `No such file or directory`, which the UI reports as keke missing |
| 6 | (Install keke button) | Not clicked: it runs `npm install -g @milisp/keke`, which fails without Node and installs globally | `install_preset` in `crates/acp/src/agents.rs` |
| 7 | After setting a folder, no login | Red text: `Internal error: no ANTHROPIC_API_KEY stored for 'anthropic'; export it, or set it in the client's login`. No sign-in action | keke defaults to `anthropic` without `config.toml`; its first-run provider picker only runs in the TUI |
| 8 | ChatGPT login present, still Anthropic | Same error until **ChatGPT** is picked in bot settings → Model → Provider | Same default |
| 9 | First message | First approval asked is `acp:codexia-bots:list_bots` ("calls the `codexia-bots` MCP server") | Internal collaboration tool asks like any MCP tool |
| 10 | Without web search config | Bot asks to run `bash` with a Python script fetching Google News (denied); then says it cannot write the brief without sources | Fresh keke has no `[providers.codex.web_search]` |
| 11 | With web search configured | Three items with links, sources labelled as secondary, delivered as a **draft** ("Draft to copy", Copy/Discard) rather than a report | Role prompt's hand-over text steers to `propose_draft` |

So a brand-new user does not reach a first brief without editing files or
knowing keke internals. Steps 4, 5, 7/8 and 10 block the demo story; 1, 3,
9 and 11 make it look unfinished.

## Gaps that affect the video

| Gap | Effect | Option for the demo |
|---|---|---|
| No phone push (APNs or Web Push) | The phone does not buzz when a step waits | Show the app being opened; or use the Telegram gateway on `feat/web-musl` as the notifier and say so |
| No Sign in with Apple/Google | The phone connects to one machine, not an account | Keep connection setup out of the video |
| Server-side MCP sign-in | Gmail only works with a Mac host | Record on the Mac |

## What the video must not claim

- A hosted service, a cloud computer per user, or that agents run while
  the host is off.
- Phone push, if Telegram or opening the app stands in for it.
- That bots never send on their own: drafts depend on the model following
  instructions; only trust levels and approval rules are enforced.
