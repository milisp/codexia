# Codexia Multi-Client Roadmap

> Note: the Telegram/Discord "bots" here are chat clients for remote control, not the agent Bots described in [BOTS.md](./BOTS.md).

Let users control their local Codexia from iOS, Telegram, and Discord.
The server (milisp.dev) only handles auth and desktop URL registration —
all actual traffic goes directly from the client to the user's desktop.

## Architecture

```
milisp.dev  (auth + address book only, no traffic relay)
  ├── POST /api/desktop/register   ← Desktop registers its tunnel URL
  └── GET  /api/desktop/url        ← iOS / bot fetches desktop URL

iOS App → https://<user-tunnel>.trycloudflare.com/api/...  (direct)
Telegram Bot → same tunnel URL (direct)
Discord Bot  → same tunnel URL (direct)
```

No relay server. milisp-web already has everything needed.

---

## Status

| Task | Status |
|------|--------|
| milisp-web auth + Supabase | done |
| Codexia desktop app-server (REST + WS) | done |
| Desktop: Cloudflare Tunnel auto-start | not started |
| milisp-web: desktop registration API | not started |
| milisp-web: Prisma migration (desktop_registrations table) | not started |
| Desktop: register URL after tunnel starts | not started |
| iOS: Tauri iOS init | not started |
| iOS: fetch desktop URL + direct connect | not started |
| Telegram bot | not started |
| Discord bot | not started |

---

## 1. milisp-web — Two API routes + one DB table

### 1.1 Prisma migration

Add to `prisma/schema.prisma`:

```prisma
model DesktopRegistration {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @unique @map("user_id") @db.Uuid
  url       String   // e.g. https://xxx.trycloudflare.com
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("desktop_registrations")
}
```

### 1.2 POST /api/desktop/register

`app/api/desktop/register/route.ts`

- Auth: verify Supabase session (user must be logged in)
- Body: `{ url: string }`
- Upsert `DesktopRegistration` for this user_id
- Returns `{ ok: true }`

### 1.3 GET /api/desktop/url

`app/api/desktop/url/route.ts`

- Auth: verify Supabase session
- Returns `{ url: string }` for the authenticated user
- 404 if desktop has never registered

---

## 2. Codexia Desktop — Cloudflare Tunnel + registration

### 2.1 Auto-start tunnel

On login, Codexia starts `cloudflared tunnel --url http://localhost:<app-server-port>` as a child process, parses the assigned URL from stdout, then calls milisp.dev to register it.

Cloudflared binary options:
- Bundle `cloudflared` in Codexia as an external binary (`externalBin` in tauri.conf.json)
- Or detect if installed, prompt user to install if missing

### 2.2 Tauri commands

```
tunnel_start()    → starts cloudflared, returns public URL, registers with milisp.dev
tunnel_stop()     → kills cloudflared process
tunnel_status()   → returns { url, connected }
```

New file: `src-tauri/src/tunnel.rs`

### 2.3 Frontend

- Settings page: show tunnel URL + copy button + on/off toggle
- Sidebar indicator: green = tunnel online, grey = offline

---

## 3. iOS — Tauri iOS thin client

### 3.1 Init

```bash
bun tauri ios init
```

Add to `tauri.conf.json`:
```json
"deep-link": {
  "desktop": { "schemes": ["codexia"] },
  "mobile":  { "schemes": ["codexia"] }
}
```

### 3.2 Connection flow

1. User logs in via Supabase (same OAuth, `codexia://auth/callback` works on iOS)
2. App calls `GET milisp.dev/api/desktop/url` → gets `https://xxx.trycloudflare.com`
3. All API calls go to that URL directly (no relay)

### 3.3 JS adapter

`src/services/desktop-url.ts` — replace hardcoded `localhost` with the fetched desktop URL when running on iOS/mobile.

### 3.4 iOS-specific gates

Hide desktop-only UI when on iOS: terminal, local file browser, git panel.
Show "Desktop offline" screen when `/api/desktop/url` returns 404.

### 3.5 App Store requirements

- Add Sign in with Apple alongside Supabase OAuth (App Store mandatory)
- Privacy manifest (`PrivacyInfo.xcprivacy`) required since iOS 17

---

## 4. Telegram Bot

Standalone script (`bots/telegram/`), talks directly to the user's desktop tunnel URL.

### Account linking

1. User sends `/link` to bot
2. Bot replies with `https://milisp.dev/link/telegram?chat_id=<id>`
3. User logs in via Supabase → milisp.dev saves `telegram_chat_id → user_id`
4. Bot looks up user_id → fetches desktop URL → calls it directly

### New milisp-web API for bots

```
POST /api/bot/link       { platform: "telegram", platform_user_id, user_id }
GET  /api/bot/desktop    { platform: "telegram", platform_user_id } → { url }
```

Add to Prisma:
```prisma
model BotAccount {
  id             String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String @map("user_id") @db.Uuid
  platform       String  // "telegram" | "discord"
  platformUserId String  @map("platform_user_id")

  @@unique([platform, platformUserId])
  @@map("bot_accounts")
}
```

### Commands

| Command | Desktop API call |
|---------|-----------------|
| `/run <prompt>` | `POST /api/codex/turn/start` |
| `/stop` | `POST /api/codex/turn/interrupt` |
| `/status` | `GET /health` |
| `/sessions` | `GET /api/cc/list-sessions` |
| `/link` | starts account linking flow |

---

## 5. Discord Bot

Same pattern as Telegram. Use slash commands.

| Slash command | Action |
|---------------|--------|
| `/codex run <prompt>` | Start a turn |
| `/codex stop` | Interrupt |
| `/codex status` | Desktop online check |
| `/codex link` | Account linking |

---

## 6. Build Order

1. `milisp-web`: add Prisma table + two API routes (register + get URL)
2. `codexia` desktop: `tunnel.rs` — auto-start cloudflared, register URL
3. `codexia` desktop: frontend tunnel status indicator
4. iOS: `tauri ios init` + desktop URL adapter
5. Telegram bot
6. Discord bot
7. Apple Sign In (before App Store submission only)
