import { MAX_BODY_BYTES, parseBatch } from './validate';

interface Env {
  DB: D1Database;
  SUMMARY_TOKEN?: string;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
};

const UPSERT = `INSERT INTO daily_counts (day, name, version, platform, arch, count)
VALUES (?1, ?2, ?3, ?4, ?5, 1)
ON CONFLICT (day, name, version, platform, arch) DO UPDATE SET count = count + 1`;

function respond(status: number, body?: BodyInit | null, extra: HeadersInit = {}): Response {
  return new Response(body ?? null, { status, headers: { ...CORS, ...extra } });
}

/** Constant-time string comparison via SHA-256 digests + XOR accumulate. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES || !request.body) return declared > MAX_BODY_BYTES ? null : '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

async function handleEvents(request: Request, env: Env): Promise<Response> {
  const text = await readLimited(request);
  if (text === null) return respond(400, 'body too large');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return respond(400, 'bad json');
  }
  const events = parseBatch(json);
  if (!events) return respond(400, 'bad payload');
  if (events.length > 0) {
    const day = new Date().toISOString().slice(0, 10);
    const stmts = events.map((e) =>
      env.DB.prepare(UPSERT).bind(day, e.name, e.version, e.platform, e.arch)
    );
    try {
      await env.DB.batch(stmts);
    } catch (err) {
      console.error(JSON.stringify({ msg: 'db_write_failed', error: String(err) }));
      return respond(500, 'error');
    }
  }
  return respond(204);
}

async function handleSummary(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.SUMMARY_TOKEN || !(await safeEqual(token, env.SUMMARY_TOKEN))) {
    return respond(401, 'unauthorized', { 'www-authenticate': 'Bearer' });
  }
  const requested = Number.parseInt(url.searchParams.get('days') ?? '30', 10);
  const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 366) : 30;
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(
    `SELECT day, name, version, platform, arch, count FROM daily_counts
     WHERE day >= ?1 ORDER BY day DESC, name, version, platform, arch`
  )
    .bind(since)
    .all();
  return respond(200, JSON.stringify({ since, days, rows: results }), {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return respond(204);
    if (url.pathname === '/v1/events') {
      if (request.method !== 'POST') return respond(405, 'method not allowed', { allow: 'POST' });
      return handleEvents(request, env);
    }
    if (url.pathname === '/v1/summary') {
      if (request.method !== 'GET') return respond(405, 'method not allowed', { allow: 'GET' });
      return handleSummary(request, env, url);
    }
    return respond(404, 'not found');
  },
} satisfies ExportedHandler<Env>;
