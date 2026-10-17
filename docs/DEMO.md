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
