import { Activity, DollarSign, Sparkles, Zap } from 'lucide-react';
import { useMemo } from 'react';
import type { AgentHeatmaps } from '@/services/tauri/insights';
import { ActivityAreaChart } from './ActivityAreaChart';
import { AgentShareChart } from './AgentShareChart';
import { ContributionHeatmap } from './ContributionHeatmap';
import { AGENT_CONFIG, type AgentKey, type ModelPricing, type Range } from './constants';
import { StatCard } from './StatCard';
import { TokenBreakdownChart } from './TokenBreakdownChart';
import { ToolList } from './ToolList';
import { estimateCost, fmtCost, fmtTokens, pricingForModel } from './utils';

interface OverviewProps {
  heatmaps: AgentHeatmaps;
  range: Range;
  pricing: Record<string, ModelPricing>;
}

export function OverviewTab({ heatmaps, range, pricing }: OverviewProps) {
  const keys = Object.keys(AGENT_CONFIG) as AgentKey[];

  const totalSessions = keys.reduce((s, k) => s + (heatmaps[k]?.total_files ?? 0), 0);
  const totalTokens = keys.reduce((s, k) => s + (heatmaps[k]?.token_stats.total_tokens ?? 0), 0);
  const totalCost = keys.reduce((s, k) => {
    const h = heatmaps[k];
    return s + (h ? estimateCost(h.token_stats, h.models, k, pricing) : 0);
  }, 0);

  // money saved: (input_price – cache_read_price) * cache_read_tokens
  const cacheSavings = useMemo(
    () =>
      keys.reduce((s, k) => {
        const h = heatmaps[k];
        if (!h) return s;
        const p = pricingForModel(h.models[0], k, pricing);
        return s + ((p.input - p.cache_read) / 1_000_000) * h.token_stats.cache_read_tokens;
      }, 0),
    [heatmaps, pricing]
  );

  const totalActDays = useMemo(() => {
    const dates = new Set<string>();
    for (const k of keys)
      for (const d of heatmaps[k]?.data ?? []) if (d.count > 0) dates.add(d.date);
    return dates.size;
  }, [heatmaps]);

  const avgTokensPerSession = totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;

  const totalCacheRead = keys.reduce(
    (s, k) => s + (heatmaps[k]?.token_stats.cache_read_tokens ?? 0),
    0
  );
  const totalInput = keys.reduce((s, k) => s + (heatmaps[k]?.token_stats.input_tokens ?? 0), 0);
  const cacheHitRate = totalInput > 0 ? Math.round((totalCacheRead / totalInput) * 100) : 0;

  const mergedTools = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of keys) {
      for (const t of heatmaps[k]?.tool_calls ?? []) {
        m.set(t.tool_name, (m.get(t.tool_name) ?? 0) + t.count);
      }
    }
    return [...m.entries()]
      .map(([tool_name, count]) => ({ tool_name, count }))
      .sort((a, b) => b.count - a.count);
  }, [heatmaps]);

  return (
    <div className="space-y-4">
      {/* ── hero stats ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Sessions"
          value={totalSessions.toLocaleString()}
          sub={`${totalActDays} active day${totalActDays !== 1 ? 's' : ''}`}
          color="#a78bfa"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Tokens Used"
          value={fmtTokens(totalTokens)}
          sub={`≈ ${fmtTokens(avgTokensPerSession)} / session`}
          color="#34d399"
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          label="Est. Cost"
          value={fmtCost(totalCost)}
          sub={`${fmtCost(totalSessions > 0 ? totalCost / totalSessions : 0)} / session`}
          color="#f59e0b"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Cache Savings"
          value={fmtCost(cacheSavings)}
          sub={`${cacheHitRate}% cache hit rate`}
          color="#22d3ee"
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>

      {/* ── per-agent heatmaps ── */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 space-y-5">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <Activity className="h-3.5 w-3.5" />
          Activity heatmaps
        </p>
        {keys.map((k) => {
          const h = heatmaps[k];
          if (!h) return null;
          const { label, color, icon } = AGENT_CONFIG[k];
          return (
            <div key={k} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold" style={{ color }}>
                  {icon}
                  {label}
                  {h.models[0] && (
                    <span className="ml-1 font-mono font-normal text-slate-500">{h.models[0]}</span>
                  )}
                </span>
                <span className="flex flex-col gap-2 text-slate-500">
                  <span>{h.total_files.toLocaleString()} sessions</span>
                  <span>{fmtTokens(h.token_stats.total_tokens)} tokens</span>
                </span>
              </div>
              <ContributionHeatmap data={h} color={color} range={range} />
            </div>
          );
        })}
      </div>

      {/* ── activity trend + agent share ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityAreaChart heatmaps={heatmaps} range={range} />
        </div>
        <AgentShareChart heatmaps={heatmaps} pricing={pricing} />
      </div>

      {/* ── token breakdown + tools ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TokenBreakdownChart heatmaps={heatmaps} range={range} />
        <ToolList tools={mergedTools} color="#a78bfa" title="All Tools (merged)" />
      </div>
    </div>
  );
}
