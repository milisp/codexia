import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AgentHeatmaps } from '@/services/tauri/insights';
import { AGENT_CONFIG, type AgentKey, type ModelPricing } from './constants';
import { estimateCost, fmtCost, fmtTokens } from './utils';

interface Props {
  heatmaps: AgentHeatmaps;
  pricing: Record<string, ModelPricing>;
}

export function AgentShareChart({ heatmaps, pricing }: Props) {
  const keys = (Object.keys(AGENT_CONFIG) as AgentKey[]).filter((k) => !!heatmaps[k]);
  if (!keys.length) return null;

  const pieData = keys.map((k) => ({
    name: AGENT_CONFIG[k].label,
    value: heatmaps[k]!.total_files,
    color: AGENT_CONFIG[k].color,
    key: k,
  }));
  const totalSessions = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-200">Agent Distribution</h3>

      {/* donut */}
      <div className="relative mx-auto w-full max-w-[130px]">
        <ResponsiveContainer width="100%" aspect={1}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius="100%"
              innerRadius="65%"
              dataKey="value"
              strokeWidth={0}
              paddingAngle={3}
            >
              {pieData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0];
                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs shadow-xl">
                    <p className="font-semibold" style={{ color: d.payload.color }}>
                      {d.name}
                    </p>
                    <p className="text-slate-300">
                      {(d.value as number).toLocaleString()} sessions
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-100">{totalSessions.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500">sessions</span>
        </div>
      </div>

      {/* per-agent breakdown */}
      <div className="space-y-3">
        {keys.map((k) => {
          const h = heatmaps[k]!;
          const { label, color } = AGENT_CONFIG[k];
          const cost = estimateCost(h.token_stats, h.models, k, pricing);
          const cacheHitPct =
            h.token_stats.input_tokens > 0
              ? Math.round((h.token_stats.cache_read_tokens / h.token_stats.input_tokens) * 100)
              : 0;
          const pct = totalSessions > 0 ? h.total_files / totalSessions : 0;

          return (
            <div key={k} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color }}>
                  {label}
                </span>
                <span className="tabular-nums text-slate-400">{(pct * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-600">
                <span>{fmtTokens(h.token_stats.total_tokens)} tok</span>
                <span>·</span>
                <span>{fmtCost(cost)}</span>
                {cacheHitPct > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-cyan-700">{cacheHitPct}% cached</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
