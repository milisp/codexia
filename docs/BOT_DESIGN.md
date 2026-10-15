# Bot product design

Where Codexia bots should go next, measured against the always-on agent
products of autumn 2026. Every item is marked **shipped** (in the code today)
or **proposed**. Product references are interaction inspiration, not evidence
that Codexia has the same capabilities (see `AGENTS.md`, Bot experience).

## What the others do

| | Grok Bot | Dots | Muse | Hark Pro |
| --- | --- | --- | --- | --- |
| Runs on | one cloud computer shared by all of a user's bots | a cloud computer per dot | a dedicated cloud machine | a cloud computer (Handoff, up to 6 browsers) |
| Entry point | role gallery: 56 templates in 9 functions | chat + Activity / Scheduled views | chat (app or WhatsApp) | Home with proactive panels, chat, projects |
| Money | approve every spend; single-use card | every purchase approved; password changes and transfers handed back | approve each checkout; single-use cards; vault | one-tap Action Buttons ("pay", "cancel") |
| Unattended | keeps working; most templates stop at a draft | approved work continues offline | Sentinel gates outbound traffic | scheduled tasks and reminders |
| Limits reported | bots share one machine (no per-bot boundary), no email trigger, xAI models only, weekly usage meter | — | vendor-described, not audited | proactive cards can become noise; speed |

The pattern that works across the Grok gallery is **recurring work, inside
accounts one person owns, that ends in a draft a person approves**.
Monitoring and briefs, drafting for review, and portal work make up most of
it; sends, posts, bookings, submissions and purchases all stop for approval.

Hark's strength is presentation. You arrive to work that is already
prepared: action buttons replace notifications, and panels show your own data.
Its reported weakness is that too many proactive cards become noise.

## Where Codexia is already ahead (shipped)

- **A boundary per bot.** Each bot has its own project folder, memory, trust
  level and explicit MCP selection (client-only isolation). Grok Bot's bots
  share one computer and one set of logins.
- **Any model and provider.** keke routes to many vendors, and each bot picks
  its own. Grok Bot is xAI-only behind a usage meter.
- **Your machine, your bill.** Nothing is metered by Codexia, and a Mac mini
  can host bots around the clock (sleep behaviour in `BOTS.md`).
- **Hard approval rules for money.** keke `require_approval` plus Codexia's
  built-in rules: payments, purchases, refunds, transfers, subscriptions and
  MCP deletions wait for a person at every trust level. Neither a standing
  approval nor the Autonomous reviewer can answer them.
- **Unattended work waits instead of failing.** A step with no standing answer
  parks, notifies you, and continues when you answer from the desktop or over
  remote access.
- **Bot-to-bot delegation** with an allowlist the backend enforces.

## Where Codexia is behind

- **Blank-page setup.** A new bot starts from an empty role, while Grok
  offers 56 ready-made roles.
- **Schedules only.** There are no event triggers (git push, CI failure, new
  issue, file change).
- **No credential vault** and no human takeover of a browser session.

## Proposed design

### 1. Today: one place to arrive (shipped)

A **Today** view above the bot list. It holds three short sections, and
nothing is shown when nothing needs you:

1. **Needs you**: waiting approvals from every bot, with Allow/Deny inline.
   This reuses `/api/acp/waiting-approvals`, which is already shipped.
2. **Done since you looked**: one line per finished run (bot, routine, result
   summary, status). Opening one goes to the bot conversation.
3. **Coming up**: the next scheduled runs.

To avoid Hark's noise problem, Today shows only items that are actionable or
new, with no suggestions the user did not ask for. A bot that has nothing to
report stays out of it.

### 2. Draft-first results (shipped)

A run can end with **drafts**, not only chat text: an email reply, a post, a
PR description, a calendar change. Drafts appear in Today and in the bot with
**Edit / Send / Discard**. Send runs the real tool call, and it is the step
that needs approval. This turns "stops at a draft" (Grok's dominant pattern)
into a first-class object.

As shipped: the built-in `codexia-bots` tool `propose_draft(title, body,
action?)` stores the draft instead of executing. Send does not replay a stored
tool call; it continues the draft's own conversation with the final text and
asks the bot to carry out `action`, under the normal approval rules. Details
in [BOTS.md](BOTS.md#drafts-and-hand-backs).

### 3. Role templates, honest about requirements (proposed)

A template gallery in the Create Bot flow. Each template states **what it
needs** (MCP servers, schedule, trust level) and **where it stops** (draft,
report, or action with approval). Only roles Codexia can actually run are
listed:

| Group | Examples | Needs | Stops at |
| --- | --- | --- | --- |
| Engineering | PR reviewer, CI failure triager, dependency upgrader, bug reproducer, docs auditor | project folder, GitHub MCP | report or PR draft |
| Briefs and monitoring | daily brief, competitor watch, release notes digest | web search; optional RSS/Slack MCP | report |
| Inbox and calendar | inbox triage, meeting prep | Gmail/Calendar MCP | drafts |
| Operations | expense summary, invoice matcher | Drive/Sheets MCP | report; payments always ask |
| Personal | subscription review, travel options | web search | list; cancellations and bookings ask |

Templates are starting points: they prefill name, role prompt, schedule and
suggested tools. A missing MCP server shows as "Connect GitHub" next to the
template rather than failing on the first run.

### 4. Event triggers (proposed)

Routines get **When** as well as **Every**. Triggers come from things Codexia
already watches or can poll cheaply: a git branch updated in the bot's
project, a GitHub issue or PR assigned or labelled (via the GitHub MCP or
`gh`), a CI run failing, a file appearing in a folder. Grok Bot reportedly
cannot trigger on email; a local agent can watch what is on the machine.

### 5. Hand-back steps (shipped)

Dots hands password changes and transfers back to the person. In Codexia, a
step that needs a secret or a login becomes a **hand-back card**: the bot
explains what is needed and pauses, and you complete it yourself on the
desktop. Codexia does not see or store the secret. A vault is out of scope
until there is an audited design.

## Order

1. Today view (reuses shipped approvals and run records; highest leverage).
2. Draft-first results.
3. Role templates.
4. Event triggers.
5. Hand-back cards.

Each step must keep the product rules in `AGENTS.md`: settings stay secondary
to responsibilities and results, and Codexia never implies cloud execution,
always-on availability or verified connections it does not have.

## Sources

- Grok Bot use cases: <https://x.ai/bot/use-cases> (56 roles when read on
  2026-10-14); Grok Bot changelog <https://x.ai/changelog/bot>;
  analysis <https://squad.so/resources/grok-bot-use-cases> (published by a
  competitor).
- Dots: <https://help.openai.com/en/articles/20001529-dots-privacy-security-and-safety-faqs>.
- Muse: <https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/>.
- Hark Pro: <https://hark.com/articles/introducing-hark-pro>;
  review <https://gizmodo.com/hark-pro-ai-ui-2000822253>.
