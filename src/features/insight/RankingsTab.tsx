import { motion } from 'framer-motion';
import { FolderOpen, Hash, Search, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { RankItem, Rankings } from '@/services/tauri/insights';
import { fmtTokens } from './utils';

const AGENT_COLORS: Record<string, string> = {
  Claude: '#a78bfa',
  Codex: '#34d399',
  Gemini: '#60a5fa',
};

interface Props {
  rankings: Rankings;
}

type Mode = 'cwd' | 'session';

export function RankingsTab({ rankings }: Props) {
  const [mode, setMode] = useState<Mode>('cwd');
  const [search, setSearch] = useState('');

  const items = mode === 'cwd' ? rankings.by_cwd : rankings.by_session;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.key.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const maxTokens = filtered[0]?.total_tokens ?? 1;

  function shortKey(key: string, m: Mode): string {
    if (m === 'session') return key.length > 20 ? key.slice(0, 10) + '…' + key.slice(-8) : key;
    // For cwd: show last 3 path segments
    const parts = key.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length > 3 ? '…/' + parts.slice(-3).join('/') : '/' + parts.join('/');
  }

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
          <button
            onClick={() => setMode('cwd')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'cwd'
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            By Directory
          </button>
          <button
            onClick={() => setMode('session')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'session'
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            By Session
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Zap className="h-3.5 w-3.5" />
          Top {filtered.length} by token usage
        </div>

        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mode === 'cwd' ? 'Filter path…' : 'Filter session ID…'}
            className="h-8 pl-7 text-xs bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 py-12 text-center text-sm text-slate-500">
            No results
          </div>
        )}
        {filtered.map((item, idx) => (
          <RankRow
            key={item.key}
            item={item}
            rank={idx + 1}
            maxTokens={maxTokens}
            mode={mode}
            shortKey={shortKey(item.key, mode)}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  item: RankItem;
  rank: number;
  maxTokens: number;
  mode: Mode;
  shortKey: string;
}

function RankRow({ item, rank, maxTokens, mode, shortKey }: RowProps) {
  const pct = maxTokens > 0 ? item.total_tokens / maxTokens : 0;
  const inputPct = item.total_tokens > 0 ? item.input_tokens / item.total_tokens : 0;
  const outputPct = item.total_tokens > 0 ? item.output_tokens / item.total_tokens : 0;
  const cachePct = item.total_tokens > 0 ? item.cache_read_tokens / item.total_tokens : 0;
  // remainder = cache_creation etc.

  const rankColor =
    rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : '#334155';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.5) }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/50 px-4 py-3 hover:bg-slate-900/80 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* rank badge */}
        <div
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
          style={{ backgroundColor: `${rankColor}18`, color: rankColor }}
        >
          {rank}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* top row */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span
              className={`truncate font-mono text-xs text-slate-200 ${mode === 'session' ? 'text-slate-400' : ''}`}
              title={item.key}
            >
              {shortKey}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              {/* agent badges */}
              <div className="flex items-center gap-1">
                {item.agents.map((a) => (
                  <span
                    key={a}
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${AGENT_COLORS[a] ?? '#64748b'}18`,
                      color: AGENT_COLORS[a] ?? '#64748b',
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                {item.sessions.toLocaleString()} session{item.sessions !== 1 ? 's' : ''}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-200">
                {fmtTokens(item.total_tokens)}
              </span>
            </div>
          </div>

          {/* stacked token bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${inputPct * pct * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              className="h-full bg-violet-500/80"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${outputPct * pct * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
              className="h-full bg-emerald-500/60"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${cachePct * pct * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
              className="h-full bg-cyan-500/50"
            />
          </div>

          {/* sub-stats */}
          <div className="flex gap-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500/80" />
              {fmtTokens(item.input_tokens)} in
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
              {fmtTokens(item.output_tokens)} out
            </span>
            {item.cache_read_tokens > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500/50" />
                {fmtTokens(item.cache_read_tokens)} cached
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
