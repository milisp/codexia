import { describe, expect, it } from 'vitest';
import worker from '../src/index';

interface Call {
  sql: string;
  args: unknown[];
}

function fakeEnv(rows: unknown[] = []) {
  const batches: Call[][] = [];
  const DB = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            sql,
            args,
            all: async () => ({ results: rows }),
          };
        },
      };
    },
    batch: async (stmts: Call[]) => {
      batches.push(stmts.map((s) => ({ sql: s.sql, args: s.args })));
      return [];
    },
  };
  return { env: { DB, SUMMARY_TOKEN: 's3cret' } as never, batches };
}

const ev = { name: 'bot_ask', version: '0.52.0', platform: 'linux', arch: 'x86_64' };
const post = (body: string) =>
  new Request('https://t.example/v1/events', { method: 'POST', body });
const run = (r: Request, env: never) => worker.fetch(r, env);

describe('POST /v1/events', () => {
  it('aggregates valid events in one batch with UTC day and upsert', async () => {
    const { env, batches } = fakeEnv();
    const res = await run(post(JSON.stringify({ events: [ev, ev, { ...ev, name: 'bad' }] })), env);
    expect(res.status).toBe(204);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0][0].sql).toContain('ON CONFLICT');
    expect(batches[0][0].sql).toContain('count = count + 1');
    expect(batches[0][0].args).toEqual([
      new Date().toISOString().slice(0, 10),
      'bot_ask',
      '0.52.0',
      'linux',
      'x86_64',
    ]);
  });
  it('skips the db when nothing is valid', async () => {
    const { env, batches } = fakeEnv();
    const res = await run(post(JSON.stringify({ events: [{ name: 'x' }] })), env);
    expect(res.status).toBe(204);
    expect(batches).toHaveLength(0);
  });
  it('400 on bad json, too many events, and oversized body', async () => {
    const { env } = fakeEnv();
    expect((await run(post('{nope'), env)).status).toBe(400);
    expect((await run(post(JSON.stringify({ events: Array(21).fill(ev) })), env)).status).toBe(400);
    const big = JSON.stringify({ events: [], pad: 'a'.repeat(9000) });
    expect((await run(post(big), env)).status).toBe(400);
  });
  it('405 on wrong method, preflight answered with CORS', async () => {
    const { env } = fakeEnv();
    const get = await run(new Request('https://t.example/v1/events'), env);
    expect(get.status).toBe(405);
    const opt = await run(new Request('https://t.example/v1/events', { method: 'OPTIONS' }), env);
    expect(opt.status).toBe(204);
    expect(opt.headers.get('access-control-allow-origin')).toBe('*');
    expect(opt.headers.get('access-control-allow-headers')).toContain('content-type');
  });
});

describe('GET /v1/summary', () => {
  const get = (auth?: string) =>
    new Request('https://t.example/v1/summary?days=7', {
      headers: auth ? { authorization: auth } : {},
    });
  it('requires the bearer token', async () => {
    const { env } = fakeEnv();
    expect((await run(get(), env)).status).toBe(401);
    expect((await run(get('Bearer wrong'), env)).status).toBe(401);
  });
  it('returns rows with the right token', async () => {
    const rows = [{ day: '2026-09-29', name: 'bot_ask', count: 3 }];
    const { env } = fakeEnv(rows);
    const res = await run(get('Bearer s3cret'), env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { rows: unknown[] }).rows).toEqual(rows);
  });
});
