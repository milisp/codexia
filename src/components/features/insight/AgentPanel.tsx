import { Activity, Cpu, Database, DollarSign, Zap } from 'lucide-react';
import type { HeatmapData } from '@/services/tauri/insights';
import { ContributionHeatmap } from './ContributionHeatmap';
import { AGENT_CONFIG, type AgentKey, type ModelPricing, RANGES, type Range } from './constants';
import { ModelBadges } from './ModelBadges';
import { StatCard } from './StatCard';
import { ToolList } from './ToolList';
import { estimateCost, fmtCost, fmtTokens, pricingForModel } from './utils';

interface AgentPanelProps {
  agentKey: AgentKey;
  data: HeatmapData;
  range: Range;
  pricing: Record<string, ModelPricing>;
}

export function AgentPanel({ agentKey, data, range, pricing }: AgentPanelProps) {
  const { color } = AGENT_CONFIG[agentKey];
  const sessions = data.total_files;
  const actDays = data.data.filter((d) => d.count > 0).length;
  const cost = estimateCost(data.token_stats, data.models, agentKey, pricing);
  const rangeLabel =
    range === 'all' ? 'All time' : `Last ${RANGES.find((r) => r.value === range)?.label}`;

  const p = pricingForModel(data.models[0], agentKey, pricing);
  const cacheSavings = ((p.input - p.cache_read) / 1_000_000) * data.token_stats.cache_read_tokens;
  const cacheHitRate =
    data.token_stats.input_tokens > 0
      ? Math.round((data.token_stats.cache_read_tokens / data.token_stats.input_tokens) * 100)
      : 0;
  const avgTokensPerSession =
    sessions > 0 ? Math.round(data.token_stats.total_tokens / sessions) : 0;

  return (
    <div className="space-y-4">
      {/* hero stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Sessions"
          value={sessions.toLocaleString()}
          sub={`${actDays} active day${actDays !== 1 ? 's' : ''}`}
          color={color}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Tokens"
          value={fmtTokens(data.token_stats.total_tokens)}
          sub={`≈ ${fmtTokens(avgTokensPerSession)} / session`}
          color={color}
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          label="Est. Cost"
          value={fmtCost(cost)}
          sub={rangeLabel}
          color="#f59e0b"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Cache Savings"
          value={fmtCost(cacheSavings)}
          sub={`${cacheHitRate}% cache rate`}
          color="#22d3ee"
          icon={<Database className="h-4 w-4" />}
        />
      </div>

      {/* models row */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 px-4 py-3 flex items-center gap-3">
        <Cpu className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="shrink-0 text-xs text-slate-500">Models</span>
        <ModelBadges models={data.models} color={color} />
      </div>

      {/* token detail */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
        <p className="mb-3 text-xs font-medium text-slate-400">Token breakdown</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Input', val: data.token_stats.input_tokens, color: color },
            { label: 'Output', val: data.token_stats.output_tokens, color: `${color}cc` },
            { label: 'Cache Read', val: data.token_stats.cache_read_tokens, color: '#22d3ee' },
            {
              label: 'Cache Created',
              val: data.token_stats.cache_creation_tokens,
              color: '#22d3ee99',
            },
          ].map(({ label, val, color: c }) => (
            <div key={label} className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="mt-1 font-mono text-sm font-bold" style={{ color: c }}>
                {fmtTokens(val)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* heatmap */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity — {rangeLabel}
          </span>
          <span>
            {actDays} active day{actDays !== 1 ? 's' : ''}
          </span>
        </div>
        <ContributionHeatmap data={data} color={color} range={range} />
      </div>

      <ToolList tools={data.tool_calls} color={color} title="Tool Usage" />
    </div>
  );
}
