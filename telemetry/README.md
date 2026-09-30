# codexia-telemetry

A tiny anonymous telemetry collector: one Cloudflare Worker plus one D1 table of aggregated daily counters.

## Privacy statement

- No install id, user id, session id, or cookies.
- No IP address or user-agent is stored or logged. The Worker never reads them, and the code logs only DB error strings, never request bodies or headers.
- Only the event `name`, app `version`, `platform`, and `arch` are accepted, each checked against a strict allowlist or pattern. Anything else is dropped.
- The database holds only `daily_counts(day, name, version, platform, arch, count)`. Individual events cannot be reconstructed.
- Cloudflare itself may keep standard edge or request metadata on its side; this Worker does not read it.

## API

- `POST /v1/events` with `{ "events": [{ "name", "version", "platform", "arch" }] }`. At most 20 events and 8 KB. Invalid events are dropped. Returns 204; 400 for bad JSON or size; 405 for the wrong method. CORS allows any origin (`content-type` header), and OPTIONS preflight is answered.
- `GET /v1/summary?days=30` with `Authorization: Bearer <SUMMARY_TOKEN>` returns `{ since, days, rows: [...] }`.

## Deploy (maintainer)

Run from this directory (`telemetry/`):

```sh
bun install
bunx wrangler d1 create codexia-telemetry
# paste the printed database_id into wrangler.jsonc (d1_databases[0].database_id)
bunx wrangler d1 migrations apply codexia-telemetry --remote
bunx wrangler secret put SUMMARY_TOKEN     # enter a long random string
bunx wrangler deploy
```

Read numbers:

```sh
curl -H "Authorization: Bearer $SUMMARY_TOKEN" "https://codexia-telemetry.<subdomain>.workers.dev/v1/summary?days=30"
```

## Develop

```sh
bunx tsc --noEmit
bunx vitest run
```

For local dev put `SUMMARY_TOKEN=...` in `.dev.vars` (git-ignored).
